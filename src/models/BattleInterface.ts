import {CallBack} from "../utils/TypeDef";

export interface IState {
	channelId: string;
	channelType: string;
	participants: Array<string>;
	turnNum: number;
	game: IRPSExample;
	signature?: string;
}

export interface IRPSExample {
	//initialState  + //State 1         + //State even      + //State odd         +  //State ending
	//GamesToPlay   | //GamesToPlay     | //GamesToPlay     | //GamesToPlay       |  //GamesToPlay == 0
	//ScorePl       | //ScorePl         | //ScorePl         | //ScorePl           |  //ScorePl
	//ScoreOp       | //ScoreOp         | //ScoreOp         | //ScoreOp           |  //ScoreOp
	//              | //HashDecision    | //HashDecision    | //HashDecision  	  |  //HashDecision
	//              |                   | //DecsionPl       | //DecisionPl        |  //DecisionPl
	//              |                   |                   | //DecisionOp        |  //DecisionOp
	//              |                   |                   | //Salt              |  //Salt
	//              |                   |                   | //nextHashDecision  |

	gamesToPlay: number;
	scorePL: number;
	scoreOP: number;
	hashDecision?: string;
	decisionPL?: number;
	decisionOP?: number;
	salt?: string;
	nextHashDecision?: string;
}

export interface IBattle {
	players: [ {
        id: string,
        socket_id: string,
	}, {
		id: string,
		socket_id: string,
 }],
	finished: boolean,
	state: IState
	prev_state: IState
	save: (cb?: CallBack<IBattle>) => void;
	markModified: (field: string) => void;
}