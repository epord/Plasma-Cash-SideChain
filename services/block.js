const moment 								= require('moment')
    , debug 								= require('debug')('app:services:transaction')
    , async									= require('async')
    , EthUtils       						= require('ethereumjs-util')
    , { BigNumber }							= require('bignumber.js')
    , { TransactionService,
            BlockService }					= require('../services')
    , SparseMerkleTree						= require('../utils/SparseMerkleTree')
    , { getHighestOcurrence, groupBy }		= require('../utils/utils')
    , { generateLeafHash,
        generateDepositBlockRootHash,
        generateBlockHeaderHash,
		generateTransactionHash }		    = require('../utils/cryptoUtils')
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
		_id: headerHash,
		timestamp,
		root_hash: rootHash,
		block_number: blockNumber,
		transactions: transactions.map(t => t.hash)
	}, (err, block) => {
			if(err) return cb(err);

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
};

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
		if (err) return cb(err);
		if(!results) return cb(null, { statusCode: 400, message: "Last block does not exist"});

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

const depositBlock = (slot, blockNumber, owner, cb) => {

    //TODO make sure there is not other blockNumber, if there is, well... we got some trouble
    //since we will have to know which one is the one on ethereum, lets hope that does not happen

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return cb('Invalid slot');
	}

	const blockNumberBN = new BigNumber(blockNumber);
	if(blockNumberBN.isNaN()) {
		return cb('Invalid blockNumber');
	}

	const rootHash = generateDepositBlockRootHash(slotBN);
	const headerHash = generateBlockHeaderHash(blockNumberBN, rootHash);

	const blockSpent = new BigNumber(0);
	const nullAddress = EthUtils.bufferToHex(EthUtils.setLengthLeft(0, 20));

	const hash = generateTransactionHash(slotBN, blockSpent, nullAddress, owner);
	const timestamp = Date.now()

	TransactionService.findOne({ slot: slotBN })
	.exec((err, transaction) => {
		if (err) return cb(err);
		if (transaction) return cb({ statusCode: 400, message: "The transaction already exists"})

		TransactionService.create({
			slot: slotBN,
			owner: nullAddress,
			recipient: owner,
			_id: hash,
			block_spent: blockSpent,
			mined: true,
			mined_block: headerHash,
			mined_timestamp: timestamp
		}, (err, t) => {
			if(err) return cb(err)
			BlockService.create({
				_id: headerHash,
				timestamp,
				root_hash: rootHash,
				block_number: blockNumberBN,
				transactions: [t]
			}, cb);
		});
	})
};

module.exports = {
	createBlock,
	mineBlock,
	depositBlock,
};