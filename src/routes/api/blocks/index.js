import {Utils} from "../../../utils/Utils";

const express 			= require('express')
, router 						= express.Router({ mergeParams: true })
, debug 						= require('debug')('app:api:blocks')
, Status 						= require('http-status-codes')
, async							= require('async')
, BigNumber					= require("bignumber.js")
, { BlockService } 	= require('../../../services/index.js')
, { mineBlock, depositBlock, getProof }	= require('../../../services/block.js');

debug('registering /api/blocks routes');

const logError = (err) => {
	if (err && !err.statusCode) return console.log(err);
	if (err && err.statusCode) return console.log(err.message);
}
const responseWithStatus = (res) => (err, status) => {
	logError(err);
		if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (err && err.statusCode) return res.status(err.statusCode).json(err.message);
		if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
		return res.status(status.statusCode).json(status.message)
};

router.get('/:block_number([0-9]+)', (req, res, next) => {
	BlockService
		.findById(req.params.block_number)
		.exec((err, block) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(Utils.blockToJson(block));
		})
});

router.get('/', (req, res, next) => {
	BlockService
		.find({})
		.exec((err, blocks) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			//TODO: Test if this works. Before it was passed as lambda.
			res.status(Status.OK).json(blocks.map(Utils.blockToJson));
		})
});

router.post('/mine', (req, res, next) => {
	mineBlock(responseWithStatus(res));
});

/**
 * Deposit a Token
 * {
 *  "slot": int|string,
 *  "blockNumber": int|string,
 *  "owner": string (hex),
 * }
 */
router.post('/deposit', (req, res, next) => {
	const { slot, blockNumber, owner } = req.body;

	if (slot == undefined || !owner || blockNumber == undefined) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	const blockNumberBN = new BigNumber(blockNumber);
	if(blockNumberBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid blockNumber');
	}

	depositBlock(slotBN, blockNumberBN, owner, responseWithStatus(res));
});

router.post('/proof', (req, res, next) => {
	const { blockNumber, slot } = req.body;

	if (!slot || !blockNumber) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}


	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	const blockNumberBN = new BigNumber(blockNumber);
	if(blockNumberBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid blockNumber');
	}

	getProof(slotBN, blockNumber, (err, proof) => {
		if(err) return responseWithStatus(res)(err);
		return responseWithStatus(res)(null, { statusCode: 200, message: proof });
	});
});

module.exports = router;