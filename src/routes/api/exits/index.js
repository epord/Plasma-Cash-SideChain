import {Utils} from "../../../utils/Utils";

const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:exit')
	, Status 					= require('http-status-codes')
	, BigNumber       			= require('bignumber.js')

debug('registering /api/exit routes')

router.get('/data/:slot([A-Fa-f0-9]+)', (req, res, next) => {
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

router.get('/singleData/:hash([0-9a-zA-z]+)', (req, res, next) => {
	const { hash } = req.params;

	Exit.getSingleData(hash, Utils.responseWithStatus(res));


});


module.exports = router;