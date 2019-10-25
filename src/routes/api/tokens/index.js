import {Utils} from "../../../utils/Utils";
import {getHistory, getHistoryProof, getLastMinedTransaction} from "../../../services/transaction";
import {CoinStateService} from "../../../services/CoinStateService";
import { TransactionService } from '../../../services';

const express = require('express')
	, router = express.Router({ mergeParams: true })
	, debug = require('debug')('app:api:tokens')
	, Status = require('http-status-codes')
	, { getOwnedTokens } = require('../../../services/coinState')
	, BigNumber = require('bignumber.js');

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
* 	- state: only return tokens in state 'EXITING'
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

router.get('/swapping-requests/:address([0-9a-zA-Z]+)', (req, res, next) => {
	const { address } = req.params;

	TransactionService.aggregate([
		{
			$project: {
				slot: { $toString: "$slot" },
				owner: true,
				recipient: true,
				_id: true,
				block_spent: { $toString: "$block_spent" },
				mined_timestamp: true,
				timestamp: true,
				signature: true,
				swapping_slot: { $toString: "$swapping_slot" },
				hash_secret: true,
				is_swap: true,
				invalidated: true,
				recipient: true,
				mined_block: { $toString: "$mined_block" },
			}
		}, {
			$match: {
				is_swap: true,
				invalidated: false,
				recipient: address,
				mined_block: null,
			}
		}
	], (err, transactions) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);

		const swappingRequests = transactions.map(t => ({
			slot: t.slot,
			isSwap: t.is_swap,
			owner: t.owner,
			recipient: t.recipient,
			hash: t._id,
			blockSpent: t.block_spent,
			signature: t.signature,
			minedTimestamp: t.mined_timestamp,
			minedBlock: t.mined_block,
			swappingSlot: t.swapping_slot,
			hashSecret: t.hash_secret,
		}));

		res.status(Status.OK).json(swappingRequests);
	});
})



module.exports = router;