import {Utils} from "../../../utils/Utils";

const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:exit')
	, Status 					= require('http-status-codes')
	, BigNumber       			= require('bignumber.js')
	, { getExitData, getSingleData } = require('../../../services/exits')
	, { TransactionService }  = require( '../../../services')

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

	getExitData(slot, Utils.responseWithStatus(res));

});

router.get('/singleData/:hash([0-9a-zA-z]+)', (req, res, next) => {
	const { hash } = req.params;

	getSingleData(hash, Utils.responseWithStatus(res));


});


module.exports = router;