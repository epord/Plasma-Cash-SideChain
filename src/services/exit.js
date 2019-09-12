import {CryptoUtils} from "../utils/CryptoUtils";
import {Utils} from "../utils/Utils";

const BigNumber = require("bignumber.js")
, { getLastMinedTransaction} = require('./transaction')
, { TransactionService } = require('../services')
, { blockInterval, getProof } = require('./block');

const getExitDataForBlock = (slot, block, cb) => {

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid slot'});

	const blockBN = new BigNumber(block);
	if(blockBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid block'});

	TransactionService.findOne({slot: slot, mined_block: blockBN}).exec( (err, lastTransaction) => {
		if (err) return cb(err)
		if (!lastTransaction) return cb({statusCode: 400, message: 'Transaction is not in side chain'});

		generateExitData(slot, lastTransaction, cb)
	})
}


const getExitData = (slot, cb) => {
	const slotBN = new BigNumber(slot);
	if (slotBN.isNaN()) return cb({statusCode: 400, message: 'Invalid slot'});

	getLastMinedTransaction({slot: slotBN}, (err, lastTransaction) => {
		if (err) return cb(err)
		if (!lastTransaction) return cb({statusCode: 400, message: 'Slot is not in side chain'});

		generateExitData(slot, lastTransaction, cb)
	})

}

const generateExitData = (slot, lastTransaction, cb) => {
	getProof(slot, lastTransaction.mined_block, (err, lastProof) => {
		if (err) return cb(err);
		if (!lastProof) return cb({ statusCode: 500, message: 'Could not create Proof for the exiting transaction' });
		if (lastTransaction.mined_block.mod(blockInterval).isZero()) {

			TransactionService.findOne({slot: slot, mined_block: lastTransaction.block_spent}, (err, prevTransaction) => {
				if (err) return cb(err);
				if (!prevTransaction) return cb({ statusCode: 500, message: 'Did not find the previous transaction for the slot' });

				getProof(slot, prevTransaction.mined_block, (err, prevProof) => {
					if (err) return cb(err)
					if (!prevProof) return cb({ statusCode: 500, message: 'Could not create Proof for the previous transaction' });

					cb(null, { statusCode: 200, message: Utils.exitDataToJson(lastTransaction, lastProof, prevTransaction, prevProof) });
				});
			});

		} else {
			cb(null, { statusCode: 200, message: Utils.exitDataToJson(lastTransaction, lastProof, null, null) });
		}
	})
}

const getSingleData = (hash, cb) => {
	TransactionService.findById(hash).exec((err, t) => {
		if(err) return cb(err);
		if(!t)  return cb({ statusCode: 404, message: 'Transaction not found'});
		if(!t.mined_block) return cb({ statusCode: Status.CONFLICT, message: 'Transaction not yet mined'});

		getProof(t.slot, t.mined_block, (err, proof) => {
			if(err) return cb(err);

			let exitingBytes = CryptoUtils.getTransactionBytes(t.slot, t.block_spent, t.recipient);

			const exitData = {
				slot: t.slot,
				bytes: exitingBytes,
				hash: t.hash,
				proof,
				signature: t.signature,
				block: t.mined_block
			};

			return cb(null, {statusCode: 200, message: exitData})
		});
	});
}

module.exports = {
	getExitData,
	getExitDataForBlock,
	getSingleData
}