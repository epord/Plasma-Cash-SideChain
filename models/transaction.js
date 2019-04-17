const mongoose = require('mongoose');

module.exports = mongoose.Schema({

	token_id: String,

	owner: String,

	recipient: String,

	// hash
	_id: String,

	// Last block that spend token_id
	// If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
	block_spent: Number, /// TODO: bigger number

	signature: String,

	mined: {
		type: Boolean,
		default: false,
	}

});