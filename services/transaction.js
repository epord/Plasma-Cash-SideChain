const mongoose								= require('mongoose')
		, { keccak256, bufferToHex, pubToAddress } = require('ethereumjs-util')
		, { recover }              		= require('../utils/sign')
		, { TransactionModel }		= require('../models');

TransactionModel.virtual('hash').get(function() { return this._id });

const TransactionService = mongoose.model('Transaction', TransactionModel, 'transactions');

const createTransaction = (tokenId, owner, recipient, hash, blockSpent, signature, cb) => {
	/// TODO: check tokenId exists
	/// TODO: check that the last block that spent the tokenId is blockSpent

	const calculatedHash = bufferToHex(keccak256(tokenId, blockSpent, 1, recipient, owner, signature));
	// console.log(calculatedHash)
	if (hash !== calculatedHash) {
		cb('Hash invalid');
		return;
	}

	/// TODO
	// if(owner != OWNER_OF_ID) {
	// 	cb('Id corresponds to a another owner')
	// 	return;
	// }

	Buffer.prototype.hex = function() { bufferToHex(this) }
	// console.log(pubToAddress(recover(hash, signature).hex()).hex())
	console.log(bufferToHex(pubToAddress(bufferToHex(recover(hash, signature)))));
	if(owner.toLowerCase() != bufferToHex(pubToAddress(bufferToHex(recover(hash, signature))))){
		cb('Owner did not sign this');
		return;
	}

	TransactionService.create({token_id: tokenId, owner, recipient, _id: hash, block_spent: blockSpent, signature}, cb);
}

module.exports = {
	TransactionService,
	createTransaction
}