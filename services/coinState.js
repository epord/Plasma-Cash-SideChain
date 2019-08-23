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

const updateOwner = (slot, newOwner, cb) => {
	CoinStateService.updateOne({
		_id: new BigNumber(slot)
	}, {
		$set: {
			owner: newOwner.toLowerCase()
		}
	}, cb);
};

const getOwnedTokens = (owner, cb) => {
		CoinStateService.find({ owner: owner.toLowerCase(), state: "DEPOSITED" }).exec( (err, slots) => {
			if(err) return cb(err);
			return cb(null, slots.map(s => s.slot));
		});
}

module.exports = {
	exitSlot,
	updateOwner,
	getOwnedTokens
}