const mongoose = require('mongoose');

module.exports = mongoose.Schema({
	_id: String,
	players: [{
		id: String,
		socket_id: String
	}],
	finished: Boolean,
	state: Object,
	prev_state: Object,
});
