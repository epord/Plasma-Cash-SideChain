import {ApiResponse, CallBack} from "../utils/TypeDef";
import {ITransaction} from "../models/TransactionInterface";
import {Utils} from "../utils/Utils";
import {BigNumber} from "bignumber.js";

const { TransactionService, CoinStateService, BlockService } = require('./index')

export const createAtomicSwapComponent = (
	_slot: string,
	_blockSpent: string,
	_owner: string,
	_recipient: string,
	_receivingSlot: string,
	_hashSecret: string,
	_hash: string,
	_signature: string,
	cb: CallBack<ApiResponse<Object>>
) => {
	const slot = new BigNumber(_slot);
	const receivingSlot = new BigNumber(_receivingSlot);
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const hashSecret = _hashSecret.toLowerCase();
	const blockSpent = new BigNumber(_blockSpent);
	const signature = _signature.toLowerCase();

	if (slot.isNaN()) return cb({ statusCode: 400, error: 'Invalid slot' });
	if (receivingSlot.isNaN()) return cb({ statusCode: 400, error: 'Invalid receiving slot' });
	if (blockSpent.isNaN()) return cb({ statusCode: 400, error: 'Invalid blockSpent' });

	// isAtomicTransactionValid({ slot, receivingSlot,  owner, recipient, hash, hashSecret, blockSpent, signature },
	// 	(err, invalidError) => {
	// 	if (err) return cb(err);
	// 	if (invalidError) return cb({ statusCode: 400, error: invalidError });
	//
	// 	TransactionService.create({
	// 		slot: slot,
	// 		owner,
	// 		recipient,
	// 		_id: hash,
	// 		block_spent: blockSpent,
	// 		signature
	// 	}, (err: any, t: ITransaction) => {
	// 		if (err) return cb(err)
	// 		cb(null, { statusCode: 201, result: Utils.transactionToJson(t) })
	// 	});
	// })
};

