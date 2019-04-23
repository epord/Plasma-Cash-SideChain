
/// TODO: ver como explortar correctamente

const { TransactionModel, BlockModel } 	= require('../models')
			, mongoose												= require('mongoose');

TransactionModel.virtual('hash').get(function() { return this._id });
const TransactionService = mongoose.model('Transaction', TransactionModel, 'transactions');

BlockModel.virtual('header_hash').get(function() { return this._id });
const BlockService = mongoose.model('Block', BlockModel, 'blocks');

const Services = {
	BlockService,
	TransactionService
};

module.exports = Services;