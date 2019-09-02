const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:challenges')
	, { getChallengeAfterData, getChallengeBeforeData } = require("../../../services/challenges")
	, BigNumber       			= require('bignumber.js')
	, Status 					= require('http-status-codes');

debug('registering /api/challenges routes')

const responseWithStatus = (res) => (err, status) => {
	if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
	if (err && err.statusCode) return res.status(err.statusCode).json(err.message);
	if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
	return res.status(status.statusCode).json(status.message)
};

/**
 * slot
 * exitBlock
 */
router.get('/after/', (req, res, next) => {
	const { slot, exitBlock } = req.query;

	if (!slot) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter slot');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	if (!exitBlock) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter exitBlock');
	}

	const exitBlockBN = new BigNumber(exitBlock);
	if(exitBlockBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	getChallengeAfterData(slotBN, exitBlockBN, responseWithStatus(res));

});

/**
 *  slot: slot being exited
 *  parentBlock: parent of exited transaction
 */
router.get('/before', (req, res, next) => {
	const { slot, parentBlock } = req.query;

	if (!slot) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter slot');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	if (!parentBlock) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter parentBlock');
	}

	const parentBlockBN = new BigNumber(parentBlock);
	if(parentBlockBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	getChallengeBeforeData(slotBN, parentBlockBN, responseWithStatus(res));

});


module.exports = router;