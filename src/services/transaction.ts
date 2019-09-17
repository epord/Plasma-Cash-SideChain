import {CryptoUtils} from "../utils/CryptoUtils";
import {Utils} from "../utils/Utils";
import {CallBack} from "../utils/TypeDef";
import {ITransaction} from "../models/TransactionInterface";
import BigNumber from "bignumber.js";
import {IBlock} from "../models/BlockInterface";
import {getProof} from "./block";


const { recover } = require('../utils/sign')
	, { TransactionService, CoinStateService, BlockService } = require('./index')
	, async = require('async');

interface TransactionData {
	slot: BigNumber,
	owner: string,
	recipient: string,
	hash: string,
	blockSpent: BigNumber,
	signature: string
}

export const createTransaction = (
		_slot: string,
		_owner: string,
		_recipient: string,
		_hash: string,
		_blockSpent: string,
		_signature: string,
		cb: CallBack<any>
	) => {

	const slot = new BigNumber(_slot);
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const blockSpent = new BigNumber(_blockSpent);
	const signature = _signature.toLowerCase();

	if (slot.isNaN()) return cb({ statusCode: 400, message: 'Invalid slot' });
	if (blockSpent.isNaN()) return cb({ statusCode: 400, message: 'Invalid blockSpent' });

	isTransactionValid({ slot, owner, recipient, hash, blockSpent, signature }, (err, invalidError) => {
		if (err) return cb(err);
		if (invalidError) return cb({ statusCode: 400, message: invalidError });

		TransactionService.create({
			slot: slot,
			owner,
			recipient,
			_id: hash,
			block_spent: blockSpent,
			signature
		}, (err: any, t: ITransaction) => {
			if (err) return cb(err)
			cb(null, { statusCode: 201, message: Utils.transactionToJson(t) })
		});
	})
};
/**
 * Given a transaction, determines if is valid or not. Slot and BlockSpent must be BigNumbers
 * @param {*} transaction
 * @param {(err, invalidErr) => void } validateTransactionCb where err is a non-validating error, invalidErr is a validating error.
 * Callback being call without parameters means the transaction is valid
 */
export const isTransactionValid = (transaction: TransactionData, validateTransactionCb: CallBack<string>) => {
	const { slot, owner, recipient, hash, blockSpent, signature } = transaction;

	getLastMinedTransaction({ slot: slot }, (err: any, result?: ITransaction) => {

		if (err) return validateTransactionCb(err);
		let lastTransaction = result;
		if (!lastTransaction) return validateTransactionCb(null, 'Slot is not in side chain');

		lastTransaction.populate("mined_block", (err, lastTransaction) => {
			let mined_block = lastTransaction!.Mined_Block;

			if (!mined_block) return validateTransactionCb(null, 'Last mined block does not exist');

			if (!(mined_block.block_number as BigNumber).eq(blockSpent)) return validateTransactionCb(null, 'blockSpent is invalid');

			const calculatedHash = CryptoUtils.generateTransactionHash(slot, blockSpent, recipient);

			if (hash !== calculatedHash) return validateTransactionCb(null, 'Hash invalid');

			if (lastTransaction!.recipient.toLowerCase() !== owner.toLowerCase()) return validateTransactionCb(null, "Owner does not match");

			try {
				const pubAddress = CryptoUtils.pubToAddress(recover(hash, signature));
				if (owner.toLowerCase() !== pubAddress) return validateTransactionCb(null, 'Owner did not sign this');
			} catch (e) {
				console.error(e.message);
				return validateTransactionCb(null, 'Invalid Signature');
			}

			CoinStateService.findById(slot, (err: any, coinState: any) => {
				if (err) return validateTransactionCb(err);

				if (coinState.state != "DEPOSITED") {
					return validateTransactionCb(null, "Coin state is not DEPOSITED");
				} else {
					return validateTransactionCb(null);
				}
			})


		})


	})
};

export const getLastMinedTransaction = (filter: any, cb: CallBack<ITransaction>) => {
	filter.mined_block = { $ne: null }
	TransactionService
		.findOne(filter)
		.sort({ mined_block: -1 })
		.collation({ locale: "en_US", numericOrdering: true })
		.exec((err:any, transaction: ITransaction) => {
			if (err) return cb(err);
			cb(null, transaction);
		});
};


//TODO: change this require in mid-file
const { getExitDataForBlock } = require('./exit')

export const getHistory = (slot: BigNumber, cb: CallBack<Object[]>) => {
	let filter: any = { slot: slot };
	filter.mined_block = { $ne: null };
	TransactionService
		.find(filter)
		.sort({ mined_block: -1 })
		.collation({ locale: "en_US", numericOrdering: true })
		.exec((err: any, transactions: ITransaction[]) => {
			if (err) return cb(err);

			let proofRetrievers = transactions.map((t: ITransaction) =>
				(cb: CallBack<any>) => getExitDataForBlock(slot, t.mined_block, cb));
			async.parallel(proofRetrievers, (err: any, exitDatas: any) => {
				if (err) return cb(err);

				// TODO: Test if zip works like this
				cb(null, Utils.zip(transactions, exitDatas).map((pair: [any, any]) => {
					return { transaction: Utils.transactionToJson(pair[0]), exitData: pair[1].message }
				})
				);
			})
		});
};

/**
 * Gets all blocks since slot's deposit and the proof for the coin in each of them
 */
export const getHistoryProof = (slot: string, done: CallBack<any>) => {
	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) done({status: 400, message: "Invalid Slot"});

	async.waterfall([
		(next: CallBack<ITransaction>) => {
			TransactionService.findOne({
				slot: slotBN,
				block_spent: '0' // deposit
			}, next)
		},
		(depositTransaction: ITransaction, next: CallBack<any>) => {
			if (!depositTransaction) return next('The slot has never been deposited.');

			async.parallel({
				minedTransactions: (cb: CallBack<ITransaction[]>) =>
					TransactionService.find({ slot: slotBN, mined_block: { $ne: null } }).exec(cb),
				depositBlock: (cb: CallBack<IBlock>) => BlockService.findById(depositTransaction.mined_block, cb),
				historyBlocks: (cb: CallBack<IBlock[]>) => {
					BlockService.aggregate([
						{
							$project: {
								_idString: { $toString: "$_id" },
								_id: true,
								block_number: "$_id",
								transactions: true
							}
						}, {
							$match: {
								$and: [
									{ _idString: /^[0-9]*000$/ },
									{ _id: { $gt: depositTransaction.mined_block.toFixed() } }
								]
							}
						}
					])
						.collation({ locale: "en_US", numericOrdering: true })
						.exec(cb);

				}
			}, (err: any, res: { minedTransactions: ITransaction[], depositBlock: IBlock, historyBlocks: IBlock[] }) => {
				const { minedTransactions, depositBlock, historyBlocks } = res;
				if (err) return next(err);

				const blocks = [depositBlock, ...historyBlocks];

				async.parallel(blocks.map(b => (cb: CallBack<string>) => getProof(slot, b.block_number.toString(), cb)),
					(err: any, proofs: string[]) => {
						if (err) return next(err);

						const history: any = {};

						// TODO: Test if zip works like this
						Utils.zip(blocks, proofs).forEach(e => {
							const transaction = minedTransactions.find(
								t => (e[0].transactions as Array<string>).includes(t.hash)
							);

							const data: any = { proof: e[1] };
							if (transaction) {
								data.hash = transaction.hash;
								data.transactionBytes = CryptoUtils.getTransactionBytes(
									transaction.slot,
									transaction.block_spent,
									transaction.recipient
								);
								data.signature = transaction.signature;
							}

							history[e[0].block_number.toString()] = data;
						});

						next(null, history);
					})
				});
			}
	], done);
};