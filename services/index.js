
/// TODO: ver como explortar correctamente

const { TransactionModel, BlockModel, CoinStateModel } 	= require('../models')
			, mongoose												= require('mongoose');

TransactionModel.virtual('hash').get(function() { return this._id });
const TransactionService = mongoose.model('Transaction', TransactionModel, 'transactions');

BlockModel.virtual('block_number').get(function() { return this._id });
const BlockService = mongoose.model('Block', BlockModel, 'blocks');

CoinStateModel.virtual('slot').get(function() { return this._id });
const CoinStateService = mongoose.model('CoinState', CoinStateModel, 'coinStates');

const Services = {
	BlockService,
	TransactionService,
	CoinStateService
};

module.exports = Services;