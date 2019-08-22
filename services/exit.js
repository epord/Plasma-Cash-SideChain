
const BigNumber = require("bignumber.js")
, { exitDataToJson } = require('../utils/utils')
, { getLastMinedTransaction, getPrevLastMinedTransaction} = require('./transaction')
, { blockInterval, getProof } = require('./block');


const getExitData = (slot, cb) => {
	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) return cb({ statusCode: 400, message: 'Invalid slot'});

	getLastMinedTransaction({ slot: slotBN }, (err, lastTransaction) => {
		if (err) return cb(err)
		if (!lastTransaction) return cb({ statusCode: 400, message: 'Slot is not in side chain' });

		getProof(slot, lastTransaction.mined_block, (err, lastProof) => {
			if (err) return cb(err)
			if (!lastProof) return cb({ statusCode: 500, message: 'Could not create Proof for the exiting transaction' });
			if (lastTransaction.mined_block.mod(blockInterval).isZero()) {

				getPrevLastMinedTransaction({ slot: slotBN }, (err, prevTransaction) => {
					if (err) return cb(err)
					if (!prevTransaction) return cb({ statusCode: 500, message: 'Did not find the previous transaction for the slot' });

					getProof(slot, prevTransaction.mined_block, (err, prevProof) => {
						if (err) return cb(err)
						if (!prevProof) return cb({ statusCode: 500, message: 'Could not create Proof for the previous transaction' });

						cb(null, { statusCode: 200, message: exitDataToJson(lastTransaction, lastProof, prevTransaction, prevProof) });
					});
				});

			} else {
				cb(null, { statusCode: 200, message: exitDataToJson(lastTransaction, lastProof, null, null) });
			}
		})

	})

}

module.exports = {
	getExitData
}