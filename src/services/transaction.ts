import {CryptoUtils} from "../utils/CryptoUtils";
import {Utils} from "../utils/Utils";
import {ApiResponse, CallBack} from "../utils/TypeDef";
import BigNumber from "bignumber.js";
import {getProof} from "./block";
import {ICoinState} from "../models/coinStateModel";
import {CoinState} from "./coinState";
import {IBlock} from "../models/block";
import {ITransaction} from "../models/transaction";
import {ISRBlock} from "../models/secretRevealingBlock";
import {Exit} from "./exits";
import {IJSONExitData} from "../routes/api/jsonModels";

const { recover } = require('../utils/sign')
	, { TransactionService, BlockService, SecretRevealingBlockService } = require('.')
	, async = require('async');

interface TransactionData {
	slot: BigNumber,
	owner: string,
	recipient: string,
	hash: string,
	blockSpent: BigNumber,
	signature?: string
}

export const toTransactionData = (t: ITransaction): TransactionData => {
	return {
		slot: t.slot,
		owner: t.owner,
		recipient: t.recipient,
		hash: t.hash,
		blockSpent: t.block_spent,
		signature: t.signature
	}
};

export const createTransaction = (
		_slot: BigNumber,
		_owner: string,
		_recipient: string,
		_hash: string,
		_blockSpent: BigNumber,
		_signature: string,
		cb: CallBack<ApiResponse<ITransaction>>
	) => {

	const slot = _slot;
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const blockSpent = _blockSpent;
	const signature = _signature.toLowerCase();

	if (slot.isNaN()) return cb({ statusCode: 400, error: 'Invalid slot' });
	if (blockSpent.isNaN()) return cb({ statusCode: 400, error: 'Invalid blockSpent' });

	isTransactionValid({ slot, owner, recipient, hash, blockSpent, signature }, (err, invalidError) => {
		if (err) return cb(err);
		if (invalidError) return cb({ statusCode: 400, error: invalidError });

		TransactionService.create({
			slot: slot,
			owner,
			recipient,
			_id: hash,
			block_spent: blockSpent,
			signature
		}, (err: any, t: ITransaction) => {
			if (err) return cb(err);
			cb(null, { statusCode: 201, result: t })
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
	const { slot, recipient, blockSpent } = transaction;
	return isTransactionValidWithHash(transaction, CryptoUtils.generateTransactionHash(slot, blockSpent, recipient), validateTransactionCb);
};

export const isTransactionValidWithHash = (transaction: TransactionData, calculatedHash: string, validateTransactionCb: CallBack<string>) => {

	getLastMinedTransaction({ slot: transaction.slot }, (err: any, result?: ITransaction) => {

		if (err) return validateTransactionCb(err);
		let lastTransaction = result;
		if (!lastTransaction) return validateTransactionCb(null, 'Slot is not in side chain');

		lastTransaction.populate("mined_block", (err, lastTransaction) => {
			let mined_block = lastTransaction!.Mined_Block;

			if (!mined_block) return validateTransactionCb(null, 'Last mined block does not exist');

			if (!(mined_block.block_number as BigNumber).eq(transaction.blockSpent)) return validateTransactionCb(null, 'blockSpent is invalid');

			if (transaction.hash !== calculatedHash) return validateTransactionCb(null, 'Hash invalid');

			if (lastTransaction!.recipient.toLowerCase() !== transaction.owner.toLowerCase()) return validateTransactionCb(null, "Owner does not match");

			try {
				const pubAddress = CryptoUtils.pubToAddress(recover(transaction.hash, transaction.signature));
				if (transaction.owner.toLowerCase() !== pubAddress) return validateTransactionCb(null, 'Owner did not sign this');
			} catch (e) {
				console.error(e.message);
				return validateTransactionCb(null, 'Invalid Signature');
			}

			CoinState.findBySlot(transaction.slot, (err: any, coinState: ICoinState) => {
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
	filter.mined_block = { $ne: null };
	filter.invalidated = false;
	TransactionService
		.findOne(filter)
		.sort({ mined_block: -1 })
		.collation({ locale: "en_US", numericOrdering: true })
		.exec(async (err:any, transaction: ITransaction) => {
			if (err) return cb(err);
			if(!transaction) return cb(null, undefined);

			if(transaction.is_swap) {
				if(transaction.invalidated) {
					filter.mined_timestamp = { $lt: transaction.mined_timestamp };
					return getLastMinedTransaction(filter, cb);
				} else {
					SecretRevealingBlockService.findById(transaction.mined_block).exec((err: any, sblock: ISRBlock) => {
						if (!sblock.is_submitted) return cb({
							statusCode: 409,
							error: `Last transaction is inside a swap that may still be valid`
						});
						return cb(null, transaction)
					});
				}
			} else {
				return cb(null, transaction);
			}
		});
};

export const getHistory = (slot: string, cb: CallBack<ApiResponse<{history: Object[]}>>) => {
	let slotBN =  new BigNumber(slot);
	if(slotBN.isNaN()) cb({status: 400, error: "Invalid Slot"});

	let filter = { slot: slotBN, mined_block: { $ne: null } };
	TransactionService
		.find(filter)
		.sort({ mined_block: -1 })
		.collation({ locale: "en_US", numericOrdering: true })
		.exec((err: any, transactions: ITransaction[]) => {
			if (err) return cb(err);

			let proofRetrievers = transactions.map(
				(t: ITransaction) =>
					(cb: CallBack<ApiResponse<IJSONExitData>>) =>
						Exit.getDataForBlock(slot.toString(), t.mined_block.toString(), cb)
			);

			async.parallel(proofRetrievers, (err: any, apiResponses: [ApiResponse<IJSONExitData>]) => {
				if (err) return cb(err);
				let result = Utils.zip(transactions, apiResponses)
					.map((pair: [any, any]) => {
						return {transaction: Utils.transactionToJson(pair[0]), exitData: pair[1].result!}
					});

				return cb(null, { statusCode: 200, result: { history: result }});
			})
		});
};

/**
 * Gets all blocks since slot's deposit and the proof for the coin in each of them
 */
export const getHistoryProof = (slot: string, done: CallBack<ApiResponse<{history: Object[]}>>) => {
	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) done({status: 400, error: "Invalid Slot"});

	async.waterfall([
		(next: CallBack<ITransaction>) => {
			TransactionService.findOne({
				slot: slotBN,
				block_spent: '0' // deposit
			}, next)
		},
		(depositTransaction: ITransaction, next: CallBack<ApiResponse<{history: Object[]}>>) => {
			if (!depositTransaction) return next({statusCode: 404, error: 'The slot has never been deposited.'});

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

						async.parallel(
							Utils.zip(blocks, proofs).map(e => async (cb: CallBack<void>) => {
								const transaction = minedTransactions.find(
									t => (e[0].transactions as Array<string>).includes(t.hash)
								);

								const data: any = { proof: e[1] };
								if (transaction) {
									data.hash = transaction.hash;
									data.transactionBytes = await CryptoUtils.getTransactionBytes(transaction);
									data.signature = transaction.signature;
									if(transaction.is_swap) {
										let counterpart = await TransactionService.findOne(
											{slot: transaction.swapping_slot, mined_block: transaction.mined_block}).exec();

										data.hashSecretA = transaction.hash_secret;
										data.hashSecretB = counterpart.hash_secret;
									}
								}

								history[e[0].block_number.toString()] = data;
								cb(null);
						}), (err: any) => next(err, {statusCode: 200, result: {history: history}}));
					})
				});
			}
	], done);
};

export const getSwapData = (hash: string, cb: CallBack<[ITransaction, ITransaction]>) => {
	TransactionService.findById(hash).exec((err: any, transaction?: ITransaction) => {
		if(err) return cb(err);
		if(!transaction) return cb({statusCode: 404, error: "Transaction Not found"});
		if(!transaction.is_swap) return cb({statusCode: 409, error: "Transaction is not a swap"});

		if(transaction.mined_block) {
			TransactionService.findOne({
				slot: transaction.swapping_slot,
				mined_block: transaction.mined_block,
			}).exec((err: any, transactionB: ITransaction) => {
				if(err) return cb(err);
				if(!transactionB) return cb({statusCode: 404, error: "Transaction is mined but counterpart is not found"});
				if(!transactionB.is_swap) return cb({statusCode: 500, error: "Transaction is mined but counterpart is not swap"});

				return cb(null, [transaction, transactionB])
			});
		} else {
			return cb({statusCode: 409, error: "Transaction is not yet mined"})
		}
	});
};

export const isSwapCommitted = (transaction: ITransaction, counterpart: ITransaction, cb: CallBack<boolean>) => {
	if(!transaction.secret) return cb(null, false);
	if(!counterpart.secret) return cb(null, false);

	SecretRevealingBlockService.findById(transaction.mined_block).exec((err: any, sblock: ISRBlock) => {
		if(err) return cb(err);
		if(!sblock) return cb(`ERROR: SecretRevealingBlock ${transaction.mined_block} was not found`);
		return cb(null, sblock.is_submitted != undefined)
	})
};