import {Utils} from "../../../utils/Utils";
import {createTransaction, getSwapData, isSwapCommitted} from "../../../services/transaction";
import {createAtomicSwapComponent, revealSecret} from "../../../services/atomicSwap";
import {getInclusionProof, getSecretProof} from "../../../services/block";
import * as async from "async";
import * as Status from 'http-status-codes'
import * as express from 'express';
import {TransactionService} from "../../../services";
import {NativeError} from "mongoose";
import {ITransaction} from "../../../models/transaction";
import BigNumber from "bignumber.js";

const router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:transactions');

debug('registering /api/transactions routes');

router.get('/:id([A-Za-z0-9]+)', (req: express.Request, res: express.Response, next) => {
	TransactionService
		.findById(req.params.id)
		.exec((err: NativeError, transaction: ITransaction) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(Utils.transactionToJson(transaction));
		})
});

router.get('/swap-data/:id([A-Za-z0-9]+)', (req: express.Request, res: express.Response, next) => {
	getSwapData(req.params.id, (err: NativeError, transactions: [ITransaction, ITransaction] | undefined) => {
		if (err) return Utils.responseWithStatus(res)(err);
		if (transactions === undefined) return Utils.responseWithStatus(res)(err);

		isSwapCommitted(transactions[0], transactions[1], (err, isCommitted) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			if (!isCommitted) return res.status(Status.OK).json(Utils.swapDataToJson({data: transactions[0]}, {data: transactions[1]}));

			async.parallel({
				firstProofA: cb => getInclusionProof(transactions[0], cb),
				firstProofB: cb => getInclusionProof(transactions[1], cb),
				secretProofA: cb => getSecretProof(transactions[0], cb),
				secretProofB: cb => getSecretProof(transactions[1], cb),
			}, (err, result) => {
				if (err) return Utils.responseWithStatus(res)(err);

				//Get AllProof
				let swapDataA = {
					data: transactions[0],
					firstInclusionProof: result.firstProofA,
					secretProof: result.secretProofA
				};

				let swapDataB = {
					data: transactions[1],
					firstInclusionProof: result.firstProofB,
					secretProof: result.secretProofB
				};

				// TODO: swapDataToJson should receive ISingleSwapData
				// @ts-ignore
                return res.status(Status.OK).json(Utils.swapDataToJson(swapDataA, swapDataB));

			});
		});
	});
});

/**
 * Creates a Transaction
 * {
 *  "slot": int|string,
 *  "blockSpent": int|string,
 *  "owner": string (hex),
 *  "recipient":string (hex),
 *  "hash": string (hex) [ keccak256(uint256(slot), uint256(blockSpent), recipient) ],
 *  "signature" string (hex) [sig of hash]
 * }
 */
router.post('/create', (req: express.Request, res: express.Response, next) => {
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

	createTransaction(slotBN, owner, recipient, hash, blockSpentBN, signature, Utils.responseWithStatus(res, Utils.transactionToJson))
});

/**
 * Creates an Atomic Swap Transaction
 * {
 *  "slot": int|string,
 *  "blockSpent": int|string,
 *  "owner": string (hex) (corresponds to A),
 *  "recipient":string (hex) (corresponds to B),
 *  "swappingSlot": int|string,
 *  "hashSecret" : string (hex)
 *  "hash": string (hex) [ keccak256(uint256(slot), uint256(blockSpent), hashSecret, recipient, swappingSlot) ],
 *  "signature" string (hex) [sig of hash]
 * }
 */
router.post('/create-atomic-swap', (req: express.Request, res: express.Response, next) => {
	const { slot, owner, recipient, hash, blockSpent, signature, swappingSlot, hashSecret } = req.body;

	if (slot == undefined || !owner || !recipient || !hash || blockSpent == undefined || swappingSlot == undefined || !hashSecret || !signature) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	createAtomicSwapComponent(
		slot,
		blockSpent,
		owner,
		recipient,
		swappingSlot,
		hashSecret,
		hash,
		signature,
		Utils.responseWithStatus(res, Utils.transactionToJson)
	)
});

/**
 * Creates an Atomic Swap Transaction
 * {
 *  "secret" : string (hex)
 *  "slot": int|string
 *  "minedBlock": int|string
 * }
 */
router.post('/reveal-secret', (req: express.Request, res: express.Response, next) => {
	const { slot, minedBlock, secret } = req.body;

	if (!secret || slot == undefined || minedBlock == undefined) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter secret');
	}

	revealSecret(slot, minedBlock, secret, Utils.responseWithStatus(res, Utils.transactionToJson));

});


/**
 * id: slot
 */
router.get('/last/:id([0-9]+)', (req: express.Request, res: express.Response, next) => {
	const slot = req.params.id;
	TransactionService
		.findOne({
			slot: new BigNumber(slot),
			mined_block: { $ne: null },
			invalidated: false
		})
		.sort({ mined_block: -1 })
		.collation({ locale: "en_US", numericOrdering: true })
		.exec(async (err, transaction) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			if(!transaction) return res.status(Status.NOT_FOUND).json("No transaction mined");
			const dto = {
				hash: transaction._id,
				isSwap: transaction.is_swap,
				owner: transaction.owner,
				recipient: transaction.recipient,
				blockSpent: transaction.block_spent,
				signature: transaction.signature,
				swappingSlot: transaction.swapping_slot,
				hashSecret: transaction.hash_secret,
				timestamp: transaction.timestamp,
				minedBlock: transaction.mined_block,
				minedTimestamp: transaction.mined_timestamp,
			};
			return res.status(Status.OK).json(dto);
		})
});


export default router;