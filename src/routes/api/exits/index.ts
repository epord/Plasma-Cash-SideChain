import {Utils} from "../../../utils/Utils";
import * as Status from 'http-status-codes'
import * as express from 'express';
import BigNumber from "bignumber.js";
import {Exit} from "../../../services/exits";

const router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:exit');

debug('registering /api/exit routes');

router.get('/data/:slot([A-Fa-f0-9]+)', (req: express.Request, res: express.Response, next) => {
	const { slot } = req.params;

	if (!slot) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	Exit.getData(slot, Utils.responseWithStatus(res));

});

router.get('/singleData/:hash([0-9a-zA-z]+)', (req: express.Request, res: express.Response, next) => {
	const { hash } = req.params;

	Exit.getSingleData(hash, Utils.responseWithStatus(res));


});

export default router;