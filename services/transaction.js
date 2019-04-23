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
	TransactionService
		.find({ token_id: tokenId })
		.sort({ mined_timestamp: -1 })
		.exec((err, transactions) => {
			if (err) return cb(err);
			if (transactions.length == 0) return cb('Token ID not in side chain');

			const lastTransaction = transactions[0];
			lastTransaction.populate({
				path: 'mined_block'
			}, (err, transaction) => {
				if (err) return cb(err);
				const { mined_block } = transaction;
				if (mined_block.block_number != blockSpent) return cb('blockSpent is invalid');

				const calculatedHash = keccak256(tokenId, blockSpent, recipient, owner);
				console.log(calculatedHash)
				if (hash !== calculatedHash) {
					cb('Hash invalid');
					return;
				}

				if(owner.toLowerCase() != pubToAddress(recover(hash, signature))) {
					cb('Owner did not sign this');
					return;
				}

				TransactionService.create({
					token_id: tokenId,
					owner,
					recipient,
					_id: hash,
					block_spent: mined_block.block_number,
					signature
				},
				cb);

			});

		})
}

module.exports = {
	createTransaction
}