const mongoose = require('mongoose');
const BigNumberSchema = require('mongoose-bignumber');

module.exports = mongoose.Schema({

	token_id:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	owner: String,

	recipient: String,

	// hash
	_id: String,

	// Last block that spend token_id
	// If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
	block_spent:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	// Block which includes this transaction
	mined_block: {
		type: String,
		ref: 'Block'
	},

	mined_timestamp: Date,

	signature: String,

	mined: {
		type: Boolean,
		default: false,
	}

});