import {ApiResponse, CallBack} from "../utils/TypeDef";
import {ITransaction} from "../models/TransactionInterface";
import {BigNumber} from "bignumber.js";
import {getLastMinedTransaction, isTransactionValidWithHash} from "./transaction";
import {CryptoUtils} from "../utils/CryptoUtils";
import {ISRBlock} from "../models/SecretRevealingBlockInterface";
import {BlockService} from ".";

const { TransactionService, CoinStateService, SecretRevealingBlockService } = require('./index')

interface AtomicSwapData {
	slot: BigNumber
	swappingSlot: BigNumber
	owner: string
	recipient: string
	hash: string
	hashSecret: string
	blockSpent: BigNumber
	signature: string
}

export const toAtomicSwapData = (t: ITransaction) => {
	return {
		slot: t.slot,
		swappingSlot: t.swapping_slot,
		owner: t.owner,
		recipient: t.recipient,
		hash: t.hash,
		hashSecret: t.hash_secret,
		blockSpent: t.block_spent,
		signature: t.signature
	}
}

export const isAtomicSwapTransactionValid = (transaction: AtomicSwapData, validateTransactionCb: CallBack<string>) => {
	const { slot, swappingSlot, recipient, hashSecret, blockSpent } = transaction;
	const calculatedHash = CryptoUtils.generateAtomicSwapTransactionHash(slot, blockSpent, hashSecret, recipient, swappingSlot);

	if(!calculatedHash) return validateTransactionCb(null, "Invalid Hash, blockSpent can be 0 in a swap");

	isTransactionValidWithHash(transaction, calculatedHash, (err: any, result?: string) => {
		if(err || result) return validateTransactionCb(err, result);

		getLastMinedTransaction({ slot: swappingSlot }, (err: any, result?: ITransaction) => {

			if (err) return validateTransactionCb(err);
			let lastTransaction = result;
			if (!lastTransaction) return validateTransactionCb(null, 'Swapping Slot is not in side chain');

			if (lastTransaction!.recipient.toLowerCase() !== recipient.toLowerCase()) {
				return validateTransactionCb(null, "Recipient does not own the swapping slot");
			}

			CoinStateService.findById(swappingSlot, (err: any, coinState: any) => {
				if (err) return validateTransactionCb(err);

				if (coinState.state != "DEPOSITED") {
					return validateTransactionCb(null, "Swapping Slot Coin state is not DEPOSITED");
				} else {
					return validateTransactionCb(null);
				}
			});
		});

	});
};

export const createAtomicSwapComponent = (
	_slot: string,
	_blockSpent: string,
	_owner: string,
	_recipient: string,
	_swappingSlot: string,
	_hashSecret: string,
	_hash: string,
	_signature: string,
	cb: CallBack<ApiResponse<ITransaction>>
) => {
	const slot = new BigNumber(_slot);
	const swappingSlot = new BigNumber(_swappingSlot);
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const hashSecret = _hashSecret.toLowerCase();
	const blockSpent = new BigNumber(_blockSpent);
	const signature = _signature.toLowerCase();

	if (slot.isNaN()) return cb({statusCode: 400, error: 'Invalid slot'});
	if (swappingSlot.isNaN()) return cb({statusCode: 400, error: 'Invalid receiving slot'});
	if (blockSpent.isNaN()) return cb({statusCode: 400, error: 'Invalid blockSpent'});

	isAtomicSwapTransactionValid({
			slot,
			swappingSlot,
			owner,
			recipient,
			hash,
			hashSecret,
			blockSpent,
			signature
		},
		(err: any, result?: string) => {
			if (err) return cb(err);
			if (result) return cb({statusCode: 400, error: result});

			TransactionService.create({
				slot: slot,
				owner,
				recipient,
				_id: hash,
				block_spent: blockSpent,
				signature,
				is_swap: true,
				swapping_slot: swappingSlot,
				hash_secret: hashSecret,
			}, (err: any, t: ITransaction) => {
				if (err) return cb(err);
				cb(null, {statusCode: 201, result: t})
			});
		})
}

export const revealSecret = (_slot: string, _minedBlock: string, secret: string, cb: CallBack<ApiResponse<ITransaction>>) => {
	const slot = new BigNumber(_slot);
	const minedBlock = new BigNumber(_minedBlock);

	SecretRevealingBlockService.findById(minedBlock).exec((err: any, sblock: ISRBlock) => {
		if(err) return cb(err)
		if(!sblock) return cb(null, {statusCode: 409, error: "Invalid blockIncluded, this block has not atomic swaps"});
		if(sblock.isSubmitted) return cb(null, {statusCode: 409, error: "This secret-revealing block was already submitted"});

		TransactionService.findOne({ slot, mined_block: minedBlock}).exec((err: any, t: ITransaction) => {
			if(err) return cb(err);
			if(!t) return cb(null, {statusCode: 404, error: "Transaction of the slot on the mined block could not be found"});
			if(!t.is_swap) return cb(null, {statusCode: 409, error: "Transaction does not appear to be an Atomic Swap"});
			if(t.secret)  return cb(null, {statusCode: 200, result: t});
			if(!CryptoUtils.validateHash(secret, t.hash_secret)) {
				return cb({statusCode: 400, error: "Secret does not correspond to HashSecret in the transaction"});
			}

			t.secret = secret;
			t.save((err, t) => {
				if(err) return cb(err)
				cb(null, {statusCode: 202, result: t})
			});
		})

	})


}

