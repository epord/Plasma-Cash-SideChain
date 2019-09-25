const mongoose = require('mongoose');
const BigNumberSchema = require('mongoose-bignumber');

module.exports = mongoose.Schema({

	_id: {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	root_hash: String,

	timestamp: {
		type: Date,
		default: Date.now
	},

	is_submitted: {
		type: Boolean,
		default: false
	}
});
