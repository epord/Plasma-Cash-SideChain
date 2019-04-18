const { keccak256
			, bufferToHex
			, pubToAddress } 				= require('ethereumjs-util')
		, { recover }            	= require('../utils/sign')
		, { TransactionService
			, BlockService }				= require('../services');

const createTransaction = (_tokenId, _owner, _recipient, _hash, _blockSpent, _signature, cb) => {
	const tokenId = _tokenId;
	const owner = _owner.toLowerCase();
	const recipient = _recipient.toLowerCase();
	const hash = _hash.toLowerCase();
	const blockSpent = _blockSpent.toLowerCase();
	const signature = _signature.toLowerCase();


	/// TODO: check tokenId exists
	BlockService
		.findById(blockSpent)
		.exec((err, block) => {
			if (err) return cb(err);
			if (!block) return cb('blockSpent not found');
			block.populate({
				path: 'transactions'
			}, (err, block) => {
				if (err) return cb(err);
				const lastTransaction = block.transactions.find(t => t.token_id == tokenId);
				if (!lastTransaction) return cb(`blockSpent does not contain transaction with token ${tokenId}`);
				if (lastTransaction.recipient !== owner) return cb('The recipient of the previous transaction is not the current owner');


				const calculatedHash = bufferToHex(keccak256(tokenId + blockSpent +  '1' +  recipient + owner));
				console.log(calculatedHash)
				if (hash !== calculatedHash) {
					cb('Hash invalid');
					return;
				}

				Buffer.prototype.hex = function() { bufferToHex(this) }
				if(owner.toLowerCase() != bufferToHex(pubToAddress(bufferToHex(recover(hash, signature))))){
					cb('Owner did not sign this');
					return;
				}

				TransactionService.create({
					token_id: tokenId,
					owner,
					recipient,
					_id: hash,
					block_spent: block.block_number,
					signature
				},
				cb);

			});
		})
}

module.exports = {
	createTransaction
}