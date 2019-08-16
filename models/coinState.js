const mongoose = require('mongoose');
const BigNumberSchema = require('mongoose-bignumber');

module.exports = mongoose.Schema({

	_id:  {
		type: BigNumberSchema,
		scale: 0,
		required: true,
		min: '0'
	},

	state: { type: String, enum: ['DEPOSITED', 'EXITING'] }

});