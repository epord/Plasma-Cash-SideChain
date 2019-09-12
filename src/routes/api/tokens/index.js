import {Utils} from "../../../utils/Utils";

const express = require('express')
	, router = express.Router({ mergeParams: true })
	, debug = require('debug')('app:api:tokens')
	, Status = require('http-status-codes')
	, { getLastMinedTransaction, getHistory, getHistoryProof } = require('../../../services/transaction.js')
	, { getOwnedTokens } = require('../../../services/coinState')
	, BigNumber = require('bignumber.js');

debug('registering /api/tokens routes')

const responseWithStatus = (res) => (err, status) => {
	if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
	if (err && err.statusCode) return res.status(err.statusCode).json(err.message);
	if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
	return res.status(status.statusCode).json(status.message)
};

router.get('/:id([A-Fa-f0-9]+)/last-transaction', (req, res, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json(Utils.transactionToJson(transaction));
	});
});

//TODO esto es bastante hack
router.get('/:id([0-9]+)/last-owner', (req, res, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json({ last_owner: transaction.recipient });
	});
});

/*
*	Query params:
* 	- exiting: only return tokens in state 'EXITING'
*/
router.get('/owned-by/:owner([0-9a-zA-z]+)', (req, res, next) => {
  const { owner } = req.params;
	const { exiting } = req.query;

	const onlyExitingTokens = exiting === 'true';

  getOwnedTokens(owner, onlyExitingTokens, (err, slots) => {
      if(err) return responseWithStatus(res)(err);
      return responseWithStatus(res)(null, {statusCode: 200, message: slots})
  });
});

router.get('/:id([0-9a-zA-z]+)/history', (req, res, next) => {
	const { id } = req.params;
	getHistory(id, (err, history) => {
		if(err) return responseWithStatus(res)(err);
		return responseWithStatus(res)(null, {statusCode: 200, message: { history }})
	});
});

router.get('/:id([0-9a-zA-Z]+)/history-proof', (req, res, next) => {
	const { id } = req.params;
	getHistoryProof(id, (err, history) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err); // TODO: add responseWithStatus when migrating to TS
		return responseWithStatus(res)(null, {statusCode: 200, message: { history }})
	})

})




module.exports = router;