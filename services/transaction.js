const { recover }            	= require('../utils/sign')
		, { TransactionService
			, BlockService }				= require('../services')
		, { keccak256
			, pubToAddress }				= require('../utils/cryptoUtils');

const createTransaction = (_tokenId, _owner, _recipient, _hash, _blockSpent, _signature, cb) => {
	const tokenId = _tokenId;
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const blockSpent = _blockSpent;
	const signature = _signature.toLowerCase();


	/// TODO: check tokenId exists

	isTransactionValid({tokenId, owner, recipient, hash, blockSpent, signature}, (err, invalidError) => {
		if (err) return cb(err);
		if (invalidError) return cb(invalidError);

		TransactionService.create({
			token_id: tokenId,
			owner,
			recipient,
			_id: hash,
			block_spent: blockSpent,
			signature
		},
		cb);
	})
}
/**
 * Given a transaction, determines if is valid or not
 * @param {*} transaction
 * @param {(err, invalidErr)} cb where err is a non-validating error, invalidErr is a validating error.
 * Callback being call without parameters means the transaction is valid
 */
const isTransactionValid = (transaction, cb) => {
	const { tokenId, owner, recipient, hash, blockSpent, signature } = transaction;
	TransactionService
		.find({ token_id: tokenId })
		.sort({ mined_timestamp: -1 })
		.exec((err, transactions) => {
			if (err) return cb(err);
			if (transactions.length == 0) return cb(null, 'Token ID not in side chain');

			const lastTransaction = transactions[0];
			lastTransaction.populate({
				path: 'mined_block'
			}, (err, transaction) => {
				if (err) return cb(err);

				const { mined_block } = transaction;
				if (mined_block.block_number != blockSpent) return cb(null, 'blockSpent is invalid');

				const calculatedHash = keccak256(tokenId, blockSpent, recipient, owner);

				if (hash !== calculatedHash) return cb(null, 'Hash invalid');

				if(owner.toLowerCase() != pubToAddress(recover(hash, signature))) return cb(null, 'Owner did not sign this');

				cb();
		})
	})
}

module.exports = {
	createTransaction,
	isTransactionValid
}