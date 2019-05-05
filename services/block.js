const moment 									= require('moment')
		, debug 								= require('debug')('app:services:transaction')
		, async									= require('async')
		, { bufferToHex }						= require('ethereumjs-util')
		, { BigNumber }							= require('bignumber.js')
		, { TransactionService,
				BlockService }					= require('../services')
		, SparseMerkleTree						= require('../utils/SparseMerkleTree')
		, { getHighestOcurrence, groupBy }		= require('../utils/utils')
		, { generateLeafHash }					= require('../utils/cryptoUtils')
		, { isTransactionValid }				= require('../services/transaction');


const blockInterval = new BigNumber(1000);

// private function
const createBlock = (transactions, blockNumber, cb) => {
	const timestamp = moment.now();

	const maxSlotCount = getHighestOcurrence(transactions.map(t => t.slot));
	if(maxSlotCount > 1) return cb("Trying to mine 2 slots at once");

	const leaves = transactions.reduce((map, value) => {
		map[value.slot] = generateLeafHash(
			value.slot,
			value.block_spent,
			value.owner,
			value.recipient,
			value.signature
		);
		return map;
	}, {});

	const sparseMerkleTree = new SparseMerkleTree(64, leaves);
	const rootHash = sparseMerkleTree.root;
	const headerHash = generateBlockHeaderHash(blockNumber, rootHash);

	BlockService.create({
		_id: headerHash, timestamp,
		root_hash: rootHash,
		block_number: blockNumber,
		transactions: transactions.map(t => t.hash)
	}, (err, block) => {

			block.populate({
				path: 'transactions'
			}, (err, block) => {
				block.transactions.forEach(transaction => {
					transaction.mined = true;
					transaction.mined_timestamp = block.timestamp;
					transaction.mined_block = block._id;
					transaction.save();
				});
				cb();
			});
		})
}

/**
 * Given an array of set of transactions, where each array, transactions share the same slot,
 * calculates the reduced set of transactions, one for each slot, eliminating transactions that it
 * find invalid in the process
 *
 * @param {Array of set of transactions with common Slot} groupedTransactions
 * @param {(error, result) => void} cb CallBack function, where result is the final set of transactions to be added
 */
const reduceTransactionsBySlot = (groupedTransactions, cb) => {

	//Generate a paralel job for each group of transactions
	const jobs = groupedTransactions.map(group => {
		return (cb) => {
			getFirstValidTransaction(group, (err, t) => {
				if(err) return cb(err);
				if(t) return cb(null, t);
				return cb();
			})
		}
	});

	async.parallel(jobs, (err, results) => {
		if (err) return cb(err);
		cb(null, results.filter(r => r));
	});

};

/**
 * Given a set of transactions, will find the first valid one, removem those that finds invalid
 * @param {Set of transactions that share the same Slot} transactions
 * @param {Callback function (error, result)} cb where result is the first valid transaction, or undefined if none was found
 */
const getFirstValidTransaction = (transactions, cb) => {
	if(transactions.length === 0) return cb();

	//Gets the first transaction
	const t = transactions[0];

	isTransactionValid({
			slot: t.slot,
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
				debug(invalidError);
				TransactionService.deleteOne(t._id).exec((err) => {
						if(err) return cb(err);

						// Continue looking at the rest of the array in a recursive way
						transactions.shift();
						getFirstValidTransaction(transactions, cb)
				});
			}
		})
};

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

		const groupedTransactions = groupBy(transactions, "slot");
		reduceTransactionsBySlot(Object.values(groupedTransactions), (err, result) => {
			if(err) return cb(err);

			let nextNumber;
			if(!lastBlock) {
				nextNumber = new BigNumber(0);
			} else {
				const rest = lastBlock.block_number.mod(blockInterval);
				nextNumber = lastBlock.block_number.minus(rest).plus(blockInterval);
			}

			createBlock(result, nextNumber, cb);
		});
	});
};

// const depositBlock = (    , cb) => {
// 	BlockService
// 		.findOne({})
// 		.sort({ timestamp: -1 })
// 		.exec((err, lastBlock) => {
// 			if (err) {
// 				console.error(err);
// 				cb(err);
// 			}
//
// 			const nextNumber = (() => {
// 				if (!lastBlock) return 0;
// 				return (int(lastBlock.block_number / 1000) + 1) * 1000;
// 			})();
//
// 			createBlock([transaction], nextNumber, cb);
// 		});
// };

module.exports = {
	createBlock,
	mineBlock,
};