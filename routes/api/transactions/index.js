const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:transactions')
	, Status 					= require('http-status-codes')
	, { TransactionService }	= require('../../../services')
	, { createTransaction } 	= require('../../../services/transaction')
	, BigNumber       			= require('bignumber.js');

debug('registering /api/transactions routes')

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


router.post('/create', (req, res, next) => {
	const { tokenId, owner, recipient, hash, blockSpent, signature } = req.body;

	if (tokenId == undefined || !owner || !recipient || !hash || blockSpent == undefined || !signature) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	const tokenIdBN = new BigNumber(tokenId);
	if(tokenIdBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid tokenId');
	}

	const blockSpentBN = new BigNumber(blockSpent);
	if(blockSpentBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid blockSpent');
	}

	createTransaction(tokenIdBN, owner, recipient, hash, blockSpentBN, signature, (err, transaction) => {
		if (err) return res.status(Status.BAD_REQUEST).json(err);
		return res.status(Status.OK).json(transaction.hash);
	})
});

module.exports = router;