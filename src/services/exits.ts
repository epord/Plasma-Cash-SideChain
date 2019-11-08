import {ApiResponse, CallBack} from "../utils/TypeDef";
import BigNumber from "bignumber.js";
import {TransactionService} from "./index";
import {getLastMinedTransaction} from "./transaction";
import {IJSONExitData, IJSONSingleExitData} from "../routes/api/jsonModels";
import {ITransaction} from "../models/transaction";
import {blockInterval, getProof} from "./block";
import {Utils} from "../utils/Utils";
import {CryptoUtils} from "../utils/CryptoUtils";
import * as Status from 'http-status-codes';

export class Exit {
	public static getDataForBlock = (slot: string, block: string, cb:CallBack<ApiResponse<IJSONExitData>>) => {

		const slotBN = new BigNumber(slot);
		if (slotBN.isNaN()) return cb({statusCode: 400, error: 'Invalid slot'});

		const blockBN = new BigNumber(block);
		if (blockBN.isNaN()) return cb({statusCode: 400, error: 'Invalid block'});

		TransactionService.findOne({slot: slot, mined_block: blockBN}).exec((err, lastTransaction) => {
			if (err) return cb(err)
			if (!lastTransaction) return cb({statusCode: 400, error: 'Transaction is not in side chain'});

			Exit.generateData(slot, lastTransaction, cb)
		})
	};


	public static getData = (slot: string, cb: CallBack<ApiResponse<IJSONExitData>>) => {
		const slotBN = new BigNumber(slot);
		if (slotBN.isNaN()) return cb({statusCode: 400, error: 'Invalid slot'});

		getLastMinedTransaction({slot: slotBN}, (err, lastTransaction) => {
			if (err) return cb(err);
			if (!lastTransaction) return cb({statusCode: 400, error: 'Slot is not in side chain'});

			Exit.generateData(slot, lastTransaction, cb)
		})
	};

	public static generateData = (slot: string, lastTransaction: ITransaction, cb: CallBack<ApiResponse<IJSONExitData>>) => {
		getProof(slot, lastTransaction.mined_block.toString(), async (err, lastProof) => {
			if (err) return cb(err);
			if (!lastProof) return cb({statusCode: 500, error: 'Could not create Proof for the exiting transaction'});
			if (lastTransaction.mined_block.mod(blockInterval).isZero()) {
				TransactionService.findOne({
					slot: slot,
					mined_block: lastTransaction.block_spent
				}, (err, prevTransaction) => {
					if (err) return cb(err);
					if (!prevTransaction) return cb({
						statusCode: 500,
						error: 'Did not find the previous transaction for the slot'
					});

					getProof(slot, prevTransaction.mined_block.toString(), async (err, prevProof) => {
						if (err) return cb(err)
						if (!prevProof) return cb({
							statusCode: 500,
							error: 'Could not create Proof for the previous transaction'
						});

						cb(null, {
							statusCode: 200,
							result: await Utils.exitDataToJson(lastTransaction, lastProof, prevTransaction, prevProof)
						});
					});
				});

			} else {
				cb(null, {statusCode: 200, result: await Utils.exitDataToJson(lastTransaction, lastProof, undefined, undefined)});
			}
		})
	};

	public static getSingleData = (hash: string, cb: CallBack<ApiResponse<IJSONSingleExitData>>) => {
		TransactionService.findById(hash).exec((err, t) => {
			if (err) return cb(err);
			if (!t) return cb({statusCode: 404, message: 'Transaction not found'});
			if (!t.mined_block) return cb({statusCode: Status.CONFLICT, message: 'Transaction not yet mined'});

			getProof(t.slot.toString(), t.mined_block.toString(), async (err, proof) => {
				if (err) return cb(err);

				let exitingBytes = await CryptoUtils.getTransactionBytes(t);

				const exitData = {
					slot: t.slot.toString(),
					bytes: exitingBytes,
					hash: t.hash,
					proof,
					signature: t.signature,
					block: t.mined_block.toString()
				};

				return cb(null, {statusCode: Status.OK, result: exitData})
			});
		});
	}

}