const moment 											= require('moment')
		, debug 											= require('debug')('app:services:transaction')
		, async												= require('async')
		, { bufferToHex }							= require('ethereumjs-util')
		, { TransactionService,
				BlockService }						= require('../services')
		, SparseMerkleTree						= require('../utils/SparseMerkleTree')
, { getHighestOcurrence, groupBy }					= require('../utils/utils')
		, { keccak256 }								= require('../utils/cryptoUtils')
		, { isTransactionValid }			= require('../services/transaction');


// private function
const createBlock = (transactions, lastBlock, blockNumber, cb) => {
	const timestamp = moment.now();

	const maxTokenCount = getHighestOcurrence(transactions.map(t => t.token_id))
	if(maxTokenCount > 1) return cb("Trying to mine 2 token Ids at once");

	const leaves = transactions.reduce((map, value) => {
		map[value.token_id] = value.hash;
		return map;
	}, {});

	const sparseMerkleTree = new SparseMerkleTree(64, leaves);
	const rootHash = sparseMerkleTree.root
	const lastBlockHeaderHash = lastBlock ? lastBlock.header_hash : bufferToHex(Buffer.alloc(32));
	const headerHash = keccak256(blockNumber, timestamp, lastBlockHeaderHash, rootHash);

	BlockService.create({
		_id: headerHash, timestamp,
		prev: lastBlockHeaderHash,
		root_hash: rootHash,
		block_number: blockNumber,
		transactions: transactions.map(t => t.hash)
	}, (err, block) => {

			block.populate({
				path: 'transactions'
			}, (err, block) => {
				block.transactions.forEach(transaction => {
					transaction.mined = true;
					transaction.mined_timestamp = block.timestamp
					transaction.mined_block = block._id
					transaction.save();
				});
				cb();
			});
		})
}

/**
 * Given an array of set of transactions, where each array, transactions share the same tokenId,
 * calculates the reduced set of transactions, one for each tokenId, eliminating transactions that it
 * find invalid in the process
 *
 * @param {Array of set of transactions with common TokenId} groupedTransactions
 * @param {CallBack functions, (error, result) => void} cb where result is the final set of transactions to be added
 */
const reduceTransactionsByTokenId = (groupedTransactions, cb) => {

	//Generate a paralel job for each group of transactions
	const jobs = groupedTransactions.map(group => {
		return (cb) => {
			getFirstValidTransaction(group, (err, t) => {
				if(err) return cb(err);
				if(t) return cb(null, t);
				return cb();
			})
		}
	})

	async.parallel(jobs, (err, results) => {
		if (err) return cb(err);
		cb(null, results.filter(r => r));
	})

}

/**
 * Given a set of transactions, will find the first valid one, removem those that finds invalid
 * @param {Set of transactions that share the same TokenId} transactions
 * @param {Callback function (error, result)} cb where result is the first valid transaction, or undefined if none was found
 */
const getFirstValidTransaction = (transactions, cb) => {
	if(transactions.length == 0) {
		return cb();
	}

	//Gets the first transaction
	const t = transactions[0]

	isTransactionValid({
			tokenId: t.token_id,
			owner: t.owner,
			recipient: t.recipient,
			hash: t.hash,
			blockSpent: t.block_spent,
			signature: t.signature
		}, (err, invalidError) => {
			//If there is a non-validating issue, propagate
			if(err) { return cb(err); }

			//If the transaction is not invalid, return to the callback
			if(!invalidError) {
				cb(null, t)
			} else {
				//If the transaction is invalid, remove it from the Database
				//Notify somewhere who knows where
				debug(invalidError)
				TransactionService.deleteOne(t._id).exec((err) => {
						if(err) return cb(err)

						// Continue looking at the rest of the array in a recursive way
						transactions.shift()
						getFirstValidTransaction(transactions, cb)
				});
			}
		})
}

const mineBlock = (cb) => {
	async.parallel({
		lastBlock: callback => {
			BlockService
				.findOne({})
				.sort({ timestamp: -1 })
				.exec(callback);
		},
		transactions: callback => {
			TransactionService
			.find({ mined: false })
			.exec(callback);
		}
	}, (err, results) => {
		if (err) {
			return cb(err);
		}
		const { lastBlock, transactions } = results;

		const groupedTransactions = groupBy(transactions, "token_id")
		reduceTransactionsByTokenId(Object.values(groupedTransactions), (err, result) => {
			if(err) return cb(err);

			let nextNumber;
			if(!lastBlock) {
				nextNumber = 0;
			} else if(lastBlock.block_number + 1 % 1000 != 0) {
				nextNumber = lastBlock.block_number + 1
			} else {
				nextNumber = lastBlock.block_number + 2
			}

			createBlock(result, lastBlock, nextNumber, cb);
		});
	});
}

const depositBlock = (transaction, cb) => {
	BlockService
		.findOne({})
		.sort({ timestamp: -1 })
		.exec((err, lastBlock) => {
			if (err) {
				console.error(err);
				cb(err);
			}

			const nextNumber = (() => {
				if (!lastBlock) return 0;
				return (int(lastBlock.block_number / 1000) + 1) * 1000;
			})();

			createBlock([transaction], lastBlock, nextNumber, cb);
		});
}

module.exports = {
	createBlock,
	mineBlock,
	depositBlock
}