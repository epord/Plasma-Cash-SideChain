import {Utils} from "../../../utils/Utils";
import {getHistory, getHistoryProof, getLastMinedTransaction} from "../../../services/transaction";
import {CoinState} from "../../../services/coinState";
import * as Status from 'http-status-codes'
import * as express from 'express';
import {getSwappingRequests, getSwappingTokens} from "../../../services/atomicSwap";

const router = express.Router({ mergeParams: true })
	, debug = require('debug')('app:api:tokens');

debug('registering /api/tokens routes');

router.get('/:id([A-Fa-f0-9]+)/last-transaction', (req: express.Request, res: express.Response, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json(Utils.transactionToJson(transaction));
	});
});

//Test only
router.get('/:id([0-9]+)/last-owner', (req: express.Request, res: express.Response, next) => {
	const { id } = req.params;
	getLastMinedTransaction({ slot: id }, (err, transaction) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		if (!transaction) return res.status(Status.NOT_FOUND).json({});
		res.status(Status.OK).json({ lastOwner: transaction.recipient });
	});
});

/*
*	Query params:
* 	- state: only return tokens in state 'EXITING'
*/
router.get('/owned-by/:owner([0-9a-zA-z]+)', (req: express.Request, res: express.Response, next) => {
  const { owner } = req.params;
  const { state } = req.query;

    CoinState.getOwnedTokens(owner, state, Utils.responseWithStatus(res));
});

router.get('/:id([0-9a-zA-z]+)/history', (req: express.Request, res: express.Response, next) => {
	const { id } = req.params;
	getHistory(id, Utils.responseWithStatus(res));
});

router.get('/:id([0-9a-zA-Z]+)/history-proof', (req: express.Request, res: express.Response, next) => {
	const { id } = req.params;
	getHistoryProof(id, Utils.responseWithStatus(res))
});

router.get('/swapping-requests/:address([0-9a-zA-Z]+)', (req: express.Request, res: express.Response, next) => {
	const { address } = req.params;

	if (!address) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	getSwappingRequests(address, Utils.responseWithStatus(res, (arr) => arr.map(Utils.transactionToJson)));
});

router.get('/swapping-tokens/:address([0-9a-zA-Z]+)', (req: express.Request, res: express.Response, next) => {
	const { address } = req.params;

	if (!address) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	getSwappingTokens(address, Utils.responseWithStatus(res, (arr) => arr.map(Utils.transactionToJson)));
});

export default router;