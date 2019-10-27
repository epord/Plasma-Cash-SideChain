import {Utils} from "../../../utils/Utils";
import * as Status from 'http-status-codes'
import * as express from 'express';
import BigNumber from "bignumber.js";
import {Challenge} from "../../../services/challenges";

const router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:challenges');

debug('registering /api/challenges routes');

/**
 * slot
 * exitBlock
 */
router.get('/after/', (req: express.Request, res: express.Response) => {
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
router.get('/before', (req: express.Request, res: express.Response, next) => {
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

export default router;