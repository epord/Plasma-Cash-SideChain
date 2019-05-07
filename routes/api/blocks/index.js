const express 			= require('express')
, router 						= express.Router({ mergeParams: true })
, debug 						= require('debug')('app:api:blocks')
, Status 						= require('http-status-codes')
, async							= require('async')
, BigNumber					= require("bignumber.js")
, { BlockService } 	= require('../../../services')
, { mineBlock, depositBlock }	= require('../../../services/block');

debug('registering /api/blocks routes');

router.get('/:id([A-Fa-f0-9]+)', (req, res, next) => {
	res.send(`Block id: ${req.params.id}`);
});

router.get('/', (req, res, next) => {
	BlockService
		.find({})
		.exec((err, blocks) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(blocks);
		})
});

router.post('/mine', (req, res, next) => {
	mineBlock((err) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		res.status(Status.OK).json('ok');
	});
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

	depositBlock(slotBN, blockNumberBN, owner, (err) => {
		if (err) {
			if(err.statusCode) {
				return res.status(err.statusCode).json(err.message);
			}
			return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		}
			res.status(Status.OK).json('ok');
	});
});

module.exports = router;