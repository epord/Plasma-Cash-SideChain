const { CoinStateService } = require('../services')
const BigNumber = require('bignumber.js');

const exitSlot = (slot, cb) => {
	CoinStateService.updateOne({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'EXITING'
		}
	}, cb);
};

const resetSlot = (slot, cb) => {
	CoinStateService.updateOne({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'DEPOSITED'
		}
	}, cb);
};

const updateOwner = (slot, newOwner, cb) => {
	CoinStateService.updateOne({
		_id: new BigNumber(slot)
	}, {
		$set: {
			owner: newOwner.toLowerCase()
		}
	}, cb);
};

const getOwnedTokens = (owner, exiting,  cb) => {
		CoinStateService.find({ owner: owner.toLowerCase(), state: exiting ? "EXITING" : "DEPOSITED" }).exec( (err, slots) => {
			if(err) return cb(err);
			return cb(null, slots.map(s => s.slot));
		});
};

const getOwner = (token, cb) => {
	CoinStateService.findById(token).exec( (err, coin) => {
		if(err) return cb(err);
		return cb(null, coin.owner);
	});
};

module.exports = {
	exitSlot,
	updateOwner,
	getOwnedTokens,
	getOwner,
	resetSlot
}