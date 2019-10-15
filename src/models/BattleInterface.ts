import {CallBack} from "../utils/TypeDef";

export interface IState {
    turn: number
}

export interface IBattle {
	player1: {
        id: String,
        socket_id: String,
	},
	player2: {
		id: String,
		socket_id: String,
	},
	established: Boolean,
	finished: Boolean,
	state: IState
	save: (cb?: CallBack<IBattle>) => void;
	markModified: (field: String) => void;
}

export interface IJSONBattle {
	player1: {
		id: String,
		socketId: String,
	},
	player2: {
		id: String,
		socketId: String,
	},
	established: Boolean,
	finished: Boolean,
	state: IState
}