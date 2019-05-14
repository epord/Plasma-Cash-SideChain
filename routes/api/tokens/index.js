const express = require('express')
	, router = express.Router({ mergeParams: true })
	, debug = require('debug')('app:api:tokens')
	, Status = require('http-status-codes')
	, { TransactionService } = require('../../../services')
	, { createTransaction, getLastMinedTransaction } = require('../../../services/transaction')
	, BigNumber = require('bignumber.js');

debug('registering /api/tokens routes')

const responseWithStatus = (res) => (err, status) => {
	if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
	if (err && err.statusCode) return res.status(err.statusCode).json(err.message);
	if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
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

router.get('/:id([0-9]+)/last-owner', (req, res, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json({ last_owner: transaction.recipient });
	});
});


module.exports = router;