const mongoose = require('mongoose');

module.exports = mongoose.Schema({
	prev: {
		type: String,
		ref: 'Block'
	},

	block_number: Number, /// TODO: bigger number

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