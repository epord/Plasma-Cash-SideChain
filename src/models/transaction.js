const mongoose = require('mongoose');
const BigNumberSchema = require('mongoose-bignumber');

module.exports = mongoose.Schema({

	slot:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	owner: String,

	recipient: String,

	// hash
	_id: String,

	// Last block that spend slot
	// If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
	block_spent:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	// Block which includes this transaction
	mined_block: {
		type: BigNumberSchema,
		ref: 'Block'
	},

	mined_timestamp: Date,

	signature: String,

	isSwap: {
		type: Boolean,
		default: false
	},

	swapping_slot:  {
		type: BigNumberSchema,
		scale: 0,
		min: '0',
	},

	hashSecret: String,
	secret: String
});