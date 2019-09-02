const { TransactionService } = require('../services');
const { getProof } = require("../services/block");
const { challengeDataToJson } = require("../utils/utils");

const getChallengeAfterData = (slot, exitBlock, cb) => {

	TransactionService.findOne({slot: slot, block_spent: exitBlock}, (err, transaction) => {

		if (err) return cb(err);
		if (!transaction) return cb({ statusCode: 404, message: 'There is no data for a Challenge After for said transaction' });

		getProof(slot, transaction.mined_block, (err, proof) => {
			if (err) return cb(err)
			if (!proof) return cb({ statusCode: 500, message: 'Could not create Proof for the previous transaction' });

			cb(null, {statusCode: 200, message: challengeDataToJson(transaction, proof)})
		});
	});
}

const getChallengeBeforeData = (slot, parentBlock, cb) => {
	TransactionService.findOne({ slot, block_spent: { $lte: parentBlock } }, (err, transaction) => {
		if (err) return cb(err);
		if (!transaction) return cb({ statusCode: 404, message: 'There is no data for a Challenge Before for said transaction' });

		getProof(slot, transaction.mined_block, (err, proof) => {
			if (err) return cb(err)
			if (!proof) return cb({ statusCode: 500, message: 'Could not create Proof for the previous transaction' });

			cb(null, {statusCode: 200, message: challengeDataToJson(transaction, proof)})
		});
	})
}

module.exports = {
	getChallengeAfterData,
	getChallengeBeforeData,
}