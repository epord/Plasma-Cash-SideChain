import {CallBack} from "../utils/TypeDef";

export interface IState {
    turn: number
}

export interface IBattle {
	player1: {
        id: string,
        socket_id: string,
	},
	player2: {
		id: string,
		socket_id: string,
	},
	established: boolean,
	finished: boolean,
	state: IState
	save: (cb?: CallBack<IBattle>) => void;
	markModified: (field: string) => void;
}

export interface IJSONBattle {
	player1: {
		id: string,
		socketId: string,
	},
	player2: {
		id: string,
		socketId: string,
	},
	established: boolean,
	finished: boolean,
	state: IState
}