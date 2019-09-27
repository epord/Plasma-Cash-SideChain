const { CoinStateService } = require('./index')
const BigNumber = require('bignumber.js');

const exitSlot = (slot, cb) => {
	CoinStateService.findOneAndUpdate({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'EXITING'
		}
	}, cb);
};

const resetSlot = (slot, cb) => {
	CoinStateService.findOneAndUpdate({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'DEPOSITED'
		}
	}, cb);
};

const swapSlot = (slot, cb) => {
	CoinStateService.findOneAndUpdate({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'SWAPPING'
		}
	}, cb);
};

const endSwap = (slot, newOwner, cb) => {
	CoinStateService.findOneAndUpdate({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'DEPOSITED',
			owner: newOwner.toLowerCase()
		}
	}, cb);
};

const updateOwner = (slot, newOwner, cb) => {
	CoinStateService.findOneAndUpdate({
		_id: new BigNumber(slot)
	}, {
		$set: {
			owner: newOwner.toLowerCase()
		}
	}, cb);
};

const getOwnedTokens = (owner, state,  cb) => {
		CoinStateService.find({ owner: owner.toLowerCase(), state: state ? state.toUpperCase() : "DEPOSITED" }).exec( (err, slots) => {
			if(err) {
				console.error(err);
				return cb(err);
			}
			return cb(null, {statusCode: 200, result: slots.map(s => s.slot)});
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
	resetSlot,
	swapSlot,
	endSwap
};