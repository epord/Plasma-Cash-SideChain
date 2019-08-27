const BigNumber = require("bignumber.js")
, { exitDataToJson } = require('../utils/utils')
, { getLastMinedTransaction, getPrevLastMinedTransaction} = require('./transaction')
, { TransactionService, BlockService } = require('../services')
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

					cb(null, { statusCode: 200, message: exitDataToJson(lastTransaction, lastProof, prevTransaction, prevProof, slot) });
				});
			});

		} else {
			cb(null, { statusCode: 200, message: exitDataToJson(lastTransaction, lastProof, null, null, slot) });
		}
	})
}

module.exports = {
	getExitData,
	getExitDataForBlock
}