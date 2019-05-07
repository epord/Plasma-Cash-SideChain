const mongoose = require('mongoose');
const BigNumberSchema = require('mongoose-bignumber');

module.exports = mongoose.Schema({

	block_number: {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	root_hash: String,

	// header hash
	_id: String,

	timestamp: {
		type: Date,
		default: Date.now
	},

	transactions: [{
		type: String,
		ref: 'Transaction'
	}]

});
