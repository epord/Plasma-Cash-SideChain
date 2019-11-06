import {Utils} from "../../../utils/Utils";
import {getHistory, getHistoryProof, getLastMinedTransaction} from "../../../services/transaction";
import {TransactionService} from '../../../services';
import {CoinState} from "../../../services/coinState";
import * as Status from 'http-status-codes'
import * as express from 'express';
import {NativeError} from "mongoose";
import {ITransaction} from "../../../models/transaction";
import BigNumber from "bignumber.js";

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
	], (err: NativeError, transactions: ITransaction[]) => {
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
});

router.get('/swapping-tokens/:address([0-9a-zA-Z]+)', (req: express.Request, res: express.Response, next) => {
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
				secret: true,
				hash_secret: true,
				is_swap: true,
				invalidated: true,
				mined_block: { $toString: "$mined_block" },
			}
		}, {
			$match: {
				is_swap: true,
				invalidated: false,
				recipient: address,
				mined_block: { $ne: null },
				secret: null,
			}
		}
	], (err: NativeError, transactions: ITransaction[]) => {
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
});

export default router;