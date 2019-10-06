import {Utils} from "../../../utils/Utils";
import {getHistory, getHistoryProof, getLastMinedTransaction} from "../../../services/transaction";
import {CoinStateService} from "../../../services/CoinStateService";

const express = require('express')
	, router = express.Router({ mergeParams: true })
	, debug = require('debug')('app:api:tokens')
	, Status = require('http-status-codes');

debug('registering /api/tokens routes')

router.get('/:id([A-Fa-f0-9]+)/last-transaction', (req, res, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json(Utils.transactionToJson(transaction));
	});
});

//Test only
router.get('/:id([0-9]+)/last-owner', (req, res, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json({ lastOwner: transaction.recipient });
	});
});

/*
*	Query params:
* 	- exiting: only return tokens in state 'EXITING'
*/
router.get('/owned-by/:owner([0-9a-zA-z]+)', (req, res, next) => {
  const { owner } = req.params;
	const { state } = req.query;

    CoinStateService.getOwnedTokens(owner, state, Utils.responseWithStatus(res));
});

router.get('/:id([0-9a-zA-z]+)/history', (req, res, next) => {
	const { id } = req.params;
	getHistory(id, Utils.responseWithStatus(res));
});

router.get('/:id([0-9a-zA-Z]+)/history-proof', (req, res, next) => {
	const { id } = req.params;
	getHistoryProof(id, (err, history) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err); // TODO: add responseWithStatus when migrating to TS
		return Utils.responseWithStatus(res)(null, {statusCode: 200, result: { history }})
	})
})

/**
 * id: address
 */
router.get('/swapping-request/:id([0-9a-zA-Z]+)', (req, res, next) => {
	const { id } = req.params;
	
})



module.exports = router;