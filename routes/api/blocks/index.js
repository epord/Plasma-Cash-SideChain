const express 			= require('express')
, router 						= express.Router({ mergeParams: true })
, debug 						= require('debug')('app:api:blocks')
, Status 						= require('http-status-codes')
, async							= require('async')
, BigNumber					= require("bignumber.js")
, { BlockService } 	= require('../../../services')
, { blocktoJson } = require('../../../utils/utils')
, { mineBlock, depositBlock }	= require('../../../services/block');

debug('registering /api/blocks routes');


const responseWithStatus = (res) => (status) => {
		if (!status) return res.status(Status.INTERNAL_SERVER_ERROR).json("No response");
		if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(status);
		return res.status(status.statusCode).json(status.message)
};

router.get('/:block_number([0-9]+)', (req, res, next) => {
	BlockService
		.findOne({ block_number: req.params.block_number})
		.exec((err, block) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(blocktoJson(block));
		})
});

router.get('/', (req, res, next) => {
	BlockService
		.find({})
		.exec((err, blocks) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(blocks.map(blocktoJson));
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

module.exports = router;