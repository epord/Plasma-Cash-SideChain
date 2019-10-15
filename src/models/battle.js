const mongoose = require('mongoose');

module.exports = mongoose.Schema({
	player1: {
		id: String,
		socket_id: String
	},
	player2: {
		id: String,
		socket_id: String
	},
	established: Boolean,
	finished: Boolean,
	state: {
		turn: {
			type: Number,
			default: 0,
		}
	}
});
