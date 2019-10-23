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

export enum Move {
	RECHARGE      = 0,
	CLEANSE       ,
	PROTECT       ,
	SHIELD_BREAK  ,
	ATK1          ,
	SPATK1        ,
	STATUS1       ,
	ATK2          ,
	SPATK2        ,
	STATUS2       ,
};

export interface ICMBState {
//Signed Player -> Signed OP        -> Signed Player

    //initialState  + //State 1    + //State even   + //State odd  +  //State ending (odd)

    //CryptoMonPL   | CryptoMonPL   | CryptoMonPL   | 0 CryptoMonPL        | CryptoMonPL
    //HPPL          | HPPL          | HPPL          | 1 HPPL               | HPPL
    //Status1PL     | Status1PL     | Status1PL     | 2 Status1PL          | Status1PL
    //Status2PL     | Status2PL     | Status2PL     | 3 Status2PL          | Status2PL
    //ChargePL      | ChargePL      | ChargePL      | 4 ChargePL           | ChargePL
    //CryptoMonOP   | CryptoMonOP   | CryptoMonOP   | 5 CryptoMonOP        | CryptoMonOP
    //HPOP          | HPOP          | HPOP          | 6 HPOP               | HPOP
    //Status1OP     | Status1OP     | Status1OP     | 7 Status1OP          | Status1OP
    //Status2OP     | Status2OP     | Status2OP     | 8 Status2OP          | Status2OP
    //ChargeOP      | ChargeOP      | ChargeOP      | 9  ChargeOP          | ChargeOP
    //              | HashDecision  | HashDecision  | 10 HashDecision      | HashDecision
    //              |               | DecisionPL    | 11 DecisionPL        | DecisionPL
    //              |               | SaltPL        | 12 SaltPL            | SaltPL
    //              |               |               | 13 DecisionOp        | DecisionOp
    //              |               |               | 14 SaltOP            | SaltOP
    //              |               |               | 15 nextHashDecision  |
		CryptoMonPL: string,
		HPPL: number,
		Status1PL: boolean,
		Status2PL: boolean,
		ChargePL: number,
		CryptoMonOP: string,
		HPOP: number,
		Status1OP: boolean,
		Status2OP: boolean,
		ChargeOP: number,
		HashDecision?: string,
		DecisionPL?: Move,
		SaltPL?: string,
		DecisionOp?: Move,
		SaltOP?: string,
		nextHashDecision?: string
}

export interface IBattle {
	_id: string,
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