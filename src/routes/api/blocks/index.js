import {Utils} from "../../../utils/Utils";
import {depositBlock, getProof, mineBlock} from "../../../services/block";

const express 			= require('express')
, router 						= express.Router({ mergeParams: true })
, debug 						= require('debug')('app:api:blocks')
, Status 						= require('http-status-codes')
, async							= require('async')
, BigNumber					= require("bignumber.js")
, { BlockService } 	= require('../../../services/index.js')

debug('registering /api/blocks routes');

const logError = (err) => {
	if (err && !err.statusCode) return console.log(err);
	if (err && err.statusCode) return console.log(err.message);
}


router.get('/:block_number([0-9]+)', (req, res, next) => {
	BlockService
		.findById(req.params.block_number)
		.populate("transactions")
		.exec((err, block) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(Utils.blockToJson(block));
		})
});

router.get('/', (req, res, next) => {
	BlockService
		.find({})
		.populate("transactions")
		.exec((err, blocks) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(blocks.map(Utils.blockToJson));
		})
});

router.post('/mine', (req, res, next) => {
	mineBlock(Utils.responseWithStatus(res, Utils.blockToJson));
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

	depositBlock(slotBN, blockNumberBN, owner, Utils.responseWithStatus(res, Utils.blockToJson));
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

	getProof(slotBN, blockNumber, Utils.responseWithStatus(res));
});

module.exports = router;