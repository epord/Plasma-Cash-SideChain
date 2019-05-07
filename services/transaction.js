const { recover }            					= require('../utils/sign')
	, { TransactionService }	= require('../services')
	, { generateTransactionHash,
		pubToAddress }						= require('../utils/cryptoUtils')
	, { BigNumber }       					= require('bignumber.js');

const createTransaction = (_slot, _owner, _recipient, _hash, _blockSpent, _signature, cb) => {
	const slot = new BigNumber(_slot);
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const blockSpent = new BigNumber(_blockSpent);
	const signature = _signature.toLowerCase();


	if(slot.isNaN()) 	return cb({statusCode: 400, message: 'Invalid slot'});
	if(blockSpent.isNaN()) 	return cb({statusCode: 400, message: 'Invalid blockSpent'});

	/// TODO: check slot exists

	isTransactionValid({slot, owner, recipient, hash, blockSpent, signature}, (err, invalidError) => {
		if (err) return cb(err);
		if (invalidError) return cb( {statusCode: 400, message: invalidError} );

		TransactionService.create({
			slot: slot,
			owner,
			recipient,
			_id: hash,
			block_spent: blockSpent,
			signature
		}, (err, t) => cb(null, { statusCode: 201, message: t.hash }));
	})
};
/**
 * Given a transaction, determines if is valid or not. Slot and BlockSpent must be BigNumbers
 * @param {*} transaction
 * @param {(err, invalidErr) => void } validateTransactionCb where err is a non-validating error, invalidErr is a validating error.
 * Callback being call without parameters means the transaction is valid
 */
const isTransactionValid = (transaction, validateTransactionCb) => {
	const { slot, owner, recipient, hash, blockSpent, signature } = transaction;

	TransactionService
		.find({ slot: slot })
		.sort({ mined_timestamp: -1 })
		.exec((err, transactions) => {
			if (err) return validateTransactionCb(err);
			if (transactions.length === 0) return validateTransactionCb(null, 'Slot is not in side chain');

			const lastTransaction = transactions[0];
			lastTransaction.populate({
				path: 'mined_block'
			}, (err, transaction) => {
				if (err) return validateTransactionCb(err);

				const { mined_block } = transaction;
				if (!mined_block) return validateTransactionCb(null, 'Last mined block does not exist');

				if (!mined_block.block_number.eq(blockSpent)) return validateTransactionCb(null, 'blockSpent is invalid');

				const calculatedHash = generateTransactionHash(slot, blockSpent, owner, recipient);

				if (hash !== calculatedHash) return validateTransactionCb(null, 'Hash invalid');

				if(lastTransaction.recipient.toLowerCase() !== owner.toLowerCase()) return validateTransactionCb(null, "Owner does not match");

				if(owner.toLowerCase() !== pubToAddress(recover(hash, signature))) return validateTransactionCb(null, 'Owner did not sign this');

				validateTransactionCb();
		})
	})
};

module.exports = {
	createTransaction,
	isTransactionValid
};