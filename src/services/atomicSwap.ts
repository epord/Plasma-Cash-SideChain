import {ApiResponse, CallBack} from "../utils/TypeDef";
import {BigNumber} from "bignumber.js";
import {getLastMinedTransaction, isTransactionValidWithHash} from "./transaction";
import {CryptoUtils} from "../utils/CryptoUtils";
import {Utils} from "../utils/Utils";
import {ICoinState} from "../models/coinStateModel";
import {CoinState} from "./coinState";
import {ITransaction} from "../models/transaction";
import {IBlock} from "../models/block";
import {ISRBlock} from "../models/secretRevealingBlock";
import {BlockService} from "./index";

const async = require("async");
const debug = require('debug')('app:services:atomicSwap');
const { TransactionService, SecretRevealingBlockService } = require('.');

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

export const toAtomicSwapData = (t: ITransaction): AtomicSwapData => {
	return {
		slot: t.slot,
		swappingSlot: t.swapping_slot,
		owner: t.owner,
		recipient: t.recipient,
		hash: t.hash,
		hashSecret: t.hash_secret,
		blockSpent: t.block_spent,
		signature: t.signature!
	}
};

export const isAtomicSwapTransactionValid = (transaction: AtomicSwapData, validateTransactionCb: CallBack<string>) => {
	const { slot, swappingSlot, recipient, hashSecret, blockSpent } = transaction;
	const calculatedHash = CryptoUtils.generateAtomicSwapTransactionHash(slot, blockSpent, hashSecret, recipient, swappingSlot);

	if(!calculatedHash) return validateTransactionCb(null, "Invalid Hash, blockSpent cant be 0 in a swap");

	isTransactionValidWithHash(transaction, calculatedHash, (err: any, result?: string) => {
		if(err || result) return validateTransactionCb(err, result);

		getLastMinedTransaction({ slot: swappingSlot }, (err: any, result?: ITransaction) => {

			if (err) return validateTransactionCb(err);
			let lastTransaction = result;
			if (!lastTransaction) return validateTransactionCb(null, 'Swapping Slot is not in side chain');

			if (lastTransaction!.recipient.toLowerCase() !== recipient.toLowerCase()) {
				return validateTransactionCb(null, "Recipient does not own the swapping slot");
			}

			CoinState.findBySlot(swappingSlot, (err: any, coinState: ICoinState) => {
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
		if(sblock.is_submitted) return cb(null, {statusCode: 409, error: "This secret-revealing block was already submitted"});

		TransactionService.findOne({ slot, mined_block: minedBlock}).exec((err: any, t: ITransaction) => {
			if(err) return cb(err);
			if(!t) return cb(null, {statusCode: 404, error: "Transaction of the slot on the mined block could not be found"});
			if(!t.is_swap) return cb(null, {statusCode: 409, error: "Transaction does not appear to be an Atomic Swap"});
			if(!CryptoUtils.validateHash(secret, t.hash_secret)) {
				return cb({statusCode: 400, error: "Secret does not correspond to HashSecret in the transaction"});
			}

			t.secret = secret;
			t.save((err, t) => {
				if(err) return cb(err);

				submitSecretBlockIfReady(minedBlock,() => cb(null, {statusCode: 202, result: t}));
			});
		})

	})
};

export const getCutoffDate = () => {
	var date = new Date();
	date.setHours(date.getHours()-23);
	return date;
};

export const checkIfAnySecretBlockReady = () => {
	SecretRevealingBlockService.find({ is_submitted: false, timestamp: { $lt: getCutoffDate() }}).exec(
		(err: any, sblock: ISRBlock[]) => {
		if(err) return debug(`ERROR: ${err.message}`);

		let functions = sblock.map((sblock: ISRBlock) => async (cb: CallBack<void>) => {
            const block = await BlockService.findById(sblock.block_number).populate("transactions").exec();
            if(!block) return debug(`ERROR: ${sblock.block_number} block not found`)

			const grouped = Utils.groupTransactionsBySlot(block.Transactions);

			const swapTransactions = block.Transactions.filter(t =>
				t.is_swap &&
				t.secret != undefined &&
				grouped.has(t.swapping_slot.toFixed()) &&
				grouped.get(t.swapping_slot.toFixed())![0].secret
			);

			const notRevelaedTransactions = block.Transactions.filter(t =>
				t.is_swap && (
					t.secret == undefined ||
					!grouped.has(t.swapping_slot.toFixed()) ||
					grouped.get(t.swapping_slot.toFixed())![0].secret == undefined
				)
			);

			sblock.root_hash = CryptoUtils.generateSecretRevealingSMTFromTransactions(swapTransactions).root;
			CryptoUtils.submitSecretBlock(sblock!, async (err: any) => {
				if(err) {
					console.error(err);
					return cb(null)
				}

				await SecretRevealingBlockService.updateOne({ _id: sblock.block_number },
					{ $set: {  is_submitted: true, root_hash: sblock.root_hash }
				});

				async.parallel(notRevelaedTransactions.map(t => (cb: CallBack<ITransaction>) => {
					t.secret = undefined;
					t.invalidated = true;
					t.save(() => {
						CoinState.resetSlot(t.slot, cb);
					})
				}));
				async.parallel(swapTransactions.map((t=> (cb: CallBack<void>) => CoinState.endSwap(t.slot, t.recipient, cb)), Utils.errorCB));


				return cb(null);
			});
		});

		async.parallel(functions)
	});
};

export const submitSecretBlockIfReady = async (minedBlock: BigNumber, cb: CallBack<void>) => {
	// @ts-ignore //TODO: Remove ts-ignore when this is fixed
    const block: IBlock  = await BlockService.findById(minedBlock).populate("transactions").exec();
	const swapTransactions = block.Transactions.filter(t => t.is_swap);
	const isAllRevealed = swapTransactions.map(t=> t.secret).indexOf(undefined) < 0;

	if(isAllRevealed) {
		const tree = CryptoUtils.generateSecretRevealingSMTFromTransactions(swapTransactions);
		const sblock: ISRBlock = await SecretRevealingBlockService.findById(minedBlock).exec();

		if(!sblock.is_submitted) {
			sblock.root_hash = tree.root;
			await SecretRevealingBlockService.updateOne({ _id: sblock.block_number }, { $set: { root_hash: tree.root } });

			CryptoUtils.submitSecretBlock(sblock!, async (err: any) => {
				if(err) {
					console.error(err);
					return cb(null)
				}

				await SecretRevealingBlockService.updateOne({ _id: sblock.block_number }, { $set: { is_submitted: true } });
				async.parallel(swapTransactions.map((t=> (cb: CallBack<void>) => CoinState.endSwap(t.slot, t.recipient, cb)), Utils.errorCB));
				return cb(null);
			});
		} else {
			return cb(null);
		}
	} else {
		return cb(null)
	}
};
