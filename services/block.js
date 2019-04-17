const mongoose										= require('mongoose')
		, moment 											= require('moment')
		, async												= require('async')
		, { keccak256, bufferToHex }	= require('ethereumjs-util')
		, { TransactionService }			= require('./transaction')
		, SparseMerkleTree						= require('../utils/SparseMerkleTree')
		, { BlockModel }							= require('../models');

BlockModel.virtual('header_hash').get(function() { return this._id });

const BlockService = mongoose.model('Block', BlockModel, 'blocks');

const createBlock = (transactions, lastBlock, blockNumber, cb) => {
	const timestamp = moment.now();

	const leaves = transactions.reduce((map, value) => {
		map[value.token_id] = value.hash;
		return map;
	}, {});

	const sparseMerkleTree = new SparseMerkleTree(64, leaves);
	const rootHash = sparseMerkleTree.root
	const lastBlockHeaderHash = lastBlock ? lastBlock.header_hash : bufferToHex(Buffer.alloc(32));
	const headerHash = bufferToHex(keccak256(blockNumber ,timestamp, lastBlockHeaderHash, rootHash));

	BlockService.create({
		_id: headerHash, timestamp,
		prev: lastBlockHeaderHash,
		root_hash: rootHash,
		block_number: blockNumber,
		transactions: transactions.map(t => t.hash)
	}, (err, block) => {

			block.populate({
				path: 'transactions'
			}, (err, block) => {

				block.transactions.forEach(transaction => {
					transaction.mined = true;
					transaction.save();
				});
				cb();
			});
		})
}

const mineBlock = (cb) => {
	async.parallel({
		lastBlock: callback => {
			BlockService
				.findOne({})
				.sort({ timestamp: -1 })
				.exec(callback);
		},
		transactions: callback => {
			TransactionService
			.find({ mined: false })
			.exec(callback);
		}
	}, (err, results) => {
		if (err) {
			return cb(err);
		}
		const { lastBlock, transactions } = results;
		const nextNumber = (() => {
			if (!lastBlock) return 0;
			return lastBlock.block_number + 1 % 1000 != 0 ? lastBlock.block_number + 1 : lastBlock.block_number + 2;
		})();

		createBlock(transactions, lastBlock, nextNumber, cb);
	})
}

const depositBlock = (transaction, cb) => {
	BlockService
		.findOne({})
		.sort({ timestamp: -1 })
		.exec((err, lastBlock) => {
			if (err) {
				console.error(err);
				cb(err);
			}

			const nextNumber = (() => {
				if (!lastBlock) return 0;
				return (int(lastBlock.block_number / 1000) + 1) * 1000;
			})();

			createBlock([transaction], lastBlock, nextNumber, cb);
		});
}

module.exports = {
	BlockService,
	createBlock,
	mineBlock,
	depositBlock
}