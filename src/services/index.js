const { TransactionModel, BlockModel, SecretRevealingBlockModel, BattleModel } = require('../models')
			, mongoose = require('mongoose');

TransactionModel.virtual('hash').get(function() { return this._id });
TransactionModel.virtual('Mined_Block').get(function() { return this.mined_block });
const TransactionService = mongoose.model('Transaction', TransactionModel, 'transactions');

BlockModel.virtual('block_number').get(function() { return this._id });
BlockModel.virtual('Transactions').get(function() { return this.transactions });
const BlockService = mongoose.model('Block', BlockModel, 'blocks');

SecretRevealingBlockModel.virtual('block_number').get(function() { return this._id });
const SecretRevealingBlockService = mongoose.model('SecretRevealingBlock', SecretRevealingBlockModel, 'secretRevealingBlocks');

const BattleService = mongoose.model('Battle', BattleModel, 'battles');

const Services = {
	BlockService,
	TransactionService,
	SecretRevealingBlockService,
	BattleService
};

module.exports = Services;