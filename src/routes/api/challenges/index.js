import {Utils} from "../../../utils/Utils";

const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:challenges')
	, BigNumber       			= require('bignumber.js')
	, Status 					= require('http-status-codes');

debug('registering /api/challenges routes')

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

	Challenge.getAfterData(slotBN, exitBlockBN, Utils.responseWithStatus(res));

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

	Challenge.getBeforeData(slotBN, parentBlockBN, Utils.responseWithStatus(res));

});


module.exports = router;