const { CoinStateService } = require('./index')
const BigNumber = require('bignumber.js');

const exitSlot = (slot, cb) => {
	CoinStateService.updateOne({
		_id: new BigNumber(slot)
	}, {
		$set: {
			state: 'EXITING'
		}
	}, cb);
}

module.exports = {
	exitSlot
}