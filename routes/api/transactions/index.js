const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:transactions')
	, Status 					= require('http-status-codes')
	, { TransactionService }	= require('../../../services')
	, { createTransaction } 	= require('../../../services/transaction')
	, BigNumber       			= require('bignumber.js');

debug('registering /api/transactions routes')

const responseWithStatus = (res) => (status) => {
	if (!status) return res.status(Status.INTERNAL_SERVER_ERROR).json("No response");
	if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(status);
	return res.status(status.statusCode).json(status.message)
};

router.get('/:id([A-Fa-f0-9]+)', (req, res, next) => {
	TransactionService
		.findById(req.params.id)
		.exec((err, transaction) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(transaction);
		})
});

router.get('/', (req, res, next) => {
	TransactionService
		.find({})
		.exec((err, transactions) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(transactions);
		})
});

/**
 * Creates a Transaction
 * {
 *  "slot": int|string,
 *  "blockSpent": int|string,
 *  "owner": string (hex),
 *  "recipient":string (hex),
 *  "hash": string (hex) [ keccak256(uint64(slot), uint256(blockSpent), owner, recipient) ],
 *  "signature" string (hex) [sig of hash]
 * }
 */
router.post('/create', (req, res, next) => {
	const { slot, owner, recipient, hash, blockSpent, signature } = req.body;

	if (slot == undefined || !owner || !recipient || !hash || blockSpent == undefined || !signature) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	const blockSpentBN = new BigNumber(blockSpent);
	if(blockSpentBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid blockSpent');
	}

	createTransaction(slotBN, owner, recipient, hash, blockSpentBN, signature, responseWithStatus(res))
});


module.exports = router;