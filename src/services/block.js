import {CryptoUtils} from "../utils/CryptoUtils";
import {Utils} from "../utils/Utils";

const moment = require('moment')
    , debug = require('debug')('app:services:transaction')
    , async = require('async')
    , EthUtils = require('ethereumjs-util')
    , { BigNumber } = require('bignumber.js')
    , { TransactionService, BlockService, CoinStateService } = require('../services')
    , { updateOwner }	= require('../services/coinState');


const blockInterval = new BigNumber(1000);

// private function
const createBlock = (transactions, blockNumber, cb) => {
	const timestamp = moment.now();

	const maxSlotCount = Utils.getHighestOccurrence(transactions.map(t => t.slot));
	if(maxSlotCount > 1) return cb({ statusCode: 500, message: "Trying to mine 2 slots at once"});


	const sparseMerkleTree = CryptoUtils.generateSMTFromTransactions(transactions);
	const rootHash = sparseMerkleTree.root;

	if(!rootHash) return cb({statusCode: 500, message: "Problem calculating merkle root hash"});

	BlockService.create({
		_id: blockNumber,
		timestamp,
		root_hash: rootHash,
		transactions: transactions.map(t => t.hash)
	}, (err, block) => {
			if(err) return cb(err);

			block.populate("transactions", (err, block) => {
				//TODO rollback
				if(err) return cb(err);

				block.transactions.forEach(transaction => {
					transaction.mined_timestamp = block.timestamp;
					transaction.mined_block = block.block_number;
					transaction.save();

					//TODO this callback?
					updateOwner(transaction.slot, transaction.recipient, (err) => { if(err) console.error(err) })
				});

				cb(null, block);
			});
		})
};

/**
 * Given an array of set of transactions, where each array, transactions share the same slot,
 * calculates the reduced set of transactions, one for each slot, eliminating transactions that it
 * find invalid in the process
 *
 * @param {Array of set of transactions with common Slot} groupedTransactions
 * @param {(error, result) => void} transactionsCb CallBack function, where result is the final set of transactions to be added
 */
const reduceTransactionsBySlot = (groupedTransactions, transactionsCb) => {

	//Generate a paralel job for each group of transactions
	const jobs = groupedTransactions.map(group => {
		return (transactionsCb) => {
			getFirstValidTransaction(group, (err, t) => {
				if(err) return transactionsCb(err);
				if(t) return transactionsCb(null, t);
				return transactionsCb();
			})
		}
	});

	async.parallel(jobs, (err, results) => {
		if (err) return transactionsCb(err);
		transactionsCb(null, results.filter(r => r));
	});

};

const mineBlock = (cb) => {
	async.parallel({
		lastBlock: callback => {
			BlockService
				.findOne({})
				.sort({_id: -1})
				.collation({locale: "en_US", numericOrdering: true})
				.exec(callback);
		},
		transactions: callback => {
			TransactionService
			.find({ mined_block: null })
			.exec(callback);
		}
	}, (err, results) => {
		if (err) return cb(err);

		const { lastBlock, transactions } = results;
		const groupedTransactions = Utils.groupTransactionsBySlot(transactions);
		reduceTransactionsBySlot(Object.values(groupedTransactions), (err, transactions) => {

			if(err) return cb(err);

			let nextNumber;
			if(!lastBlock) {
				nextNumber = blockInterval;
			} else {
				const rest = lastBlock.block_number.mod(blockInterval);
				nextNumber = lastBlock.block_number.minus(rest).plus(blockInterval);
			}

			createBlock(transactions, nextNumber, (err, block) => {
				debug(`mining ${block}`)
				if(err) return cb(err);

                CryptoUtils.submitBlock(block, (err)=> {
					if(err) return cb(err);
					cb(null, { statusCode: 201, message: Utils.blockToJson(block) });
				})
			});
		});
	});
};

const validateAndDeposit = (cb) => {
	const { slot, blockNumber, owner } = req.body;

	if (slot == undefined || !owner || blockNumber == undefined) {
		return cb('Missing parameter');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return cb('Invalid Slot');
	}

	const blockNumberBN = new BigNumber(blockNumber);
	if(blockNumberBN.isNaN()) {
		return cb('Invalid BlockNumber');
	}

	depositBlock(slotBN, blockNumberBN, owner, (err, status) => {
			if(err) return cb(err);
			cb();
	});
}

const depositBlock = (slot, blockNumber, _owner, cb) => {

	const owner = _owner.toLowerCase();

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid slot'});

	const blockNumberBN = new BigNumber(blockNumber);
	if(blockNumberBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid blockNumber'});

	const rootHash = CryptoUtils.generateDepositBlockRootHash(slotBN);

	const blockSpent = new BigNumber(0);
	const nullAddress = EthUtils.bufferToHex(EthUtils.setLengthLeft(0, 20));

	const hash = CryptoUtils.generateTransactionHash(slotBN, blockSpent, owner);
	const timestamp = Date.now();

	BlockService.findById(blockNumberBN)
		.exec((err, block) => {
			if(err) return cb(err);
			if(block) return cb({statusCode: 409, message: "Block number already deposited"});

			TransactionService.findOne({ slot: slotBN })
				.exec((err, transaction) => {
					if (err) return cb(err);
					if (transaction) return cb({ statusCode: 400, message: "The transaction already exists"});

					/// TODO: make atomic
					CoinStateService.create({
						_id: slotBN,
						state: "DEPOSITED",
						owner: owner
					});

					TransactionService.create({
						slot: slotBN,
						owner: nullAddress,
						recipient: owner,
						_id: hash,
						block_spent: blockSpent,
						mined: true,
						mined_block: blockNumberBN,
						mined_timestamp: timestamp
					}, (err, t) => {
						if(err) return cb(err);

						BlockService.create({
							_id: blockNumberBN,
							timestamp,
							root_hash: rootHash,
							transactions: [t]
						}, (err, block) => {
							if(err) return cb(err);
							cb(null, {statusCode: 201, message: Utils.blockToJson(block)})
						});
					});
				});
		});
};

const getProof = (slot, blockNumber, cb) => {

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid slot'});

	const blockNumberBN = new BigNumber(blockNumber);
	if(blockNumberBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid blockNumber'});

	BlockService
	.findById(blockNumberBN)
	.populate("transactions")
	.exec((err, block) => {
		if (err) return cb(err);

		const sparseMerkleTree = CryptoUtils.generateSMTFromTransactions(block.transactions);

		const proof = sparseMerkleTree.createMerkleProof(slotBN.toFixed());
		cb(null, proof);
	})
}

module.exports = {
	createBlock,
	mineBlock,
	depositBlock,
	validateAndDeposit,
	getProof,
	blockInterval
};

//TODO Clean up this. We had to put it down here due to cyclical dependencies
const { isTransactionValid } = require('./transaction')

/**
 * Given a set of transactions, will find the first valid one, removem those that finds invalid
 * @param {Set of transactions that share the same Slot} transactions
 * @param {Callback function (error, result)} transactionsCb where result is the first valid transaction, or undefined if none was found
 */
const getFirstValidTransaction = (transactions, transactionsCb) => {
	if(transactions.length === 0) return transactionsCb();

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
		if(err) { return transactionsCb(err); }

		//If the transaction is not invalid, return to the callback
		if(!invalidError) {
			transactionsCb(null, t)
		} else {
			//If the transaction is invalid, remove it from the DatabasFfine
			//Notify somewhere who knows where
			TransactionService.deleteOne({ _id: t._id }).exec((err) => {
				if(err) return transactionsCb(err);

				// Continue looking at the rest of the array in a recursive way
				transactions.shift();
				getFirstValidTransaction(transactions, transactionsCb)
			});
		}
	})
};