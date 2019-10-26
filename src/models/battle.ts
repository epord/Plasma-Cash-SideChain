import {Document, Schema} from "mongoose";

export interface IChannelState {
	channelId: string;
	channelType: string;
	participants: Array<string>;
	turnNum: number;
	game: ICMBState;
	signature?: string;
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
}

export enum Gender {
	Male		  = 0,
	Female		  ,
	Unknown		  ,
}

export enum Type {
	Normal			=0,
	Fighting	 	,
	Flying			,
	Poison			,
	Ground			,
	Rock			,
	Bug				,
	Ghost			,
	Steel			,
	Fire			,
	Water			,
	Grass			,
	Electric		,
	Psychic			,
	Ice				,
	Dragon			,
	Dark			,
	Fairy			,
	Unknown			,
}

export interface IStats {
	hp: number
	atk: number
	def: number
	spAtk: number
	spDef: number
	speed: number
}

export interface ICryptoMon {
	id: number,
	gender: Gender
	isShiny: boolean
	IVs: IStats
	stats: IStats
}

export interface IPokemonData {
	id: number,
	type1: Type,
	type2: Type,
	base: IStats
}

export interface ICMBState {
//Signed Player -> Signed OP        -> Signed Player

	//initialState  + //State 1    + //State even   + //State odd  +  //State ending (odd)

	//cryptoMonPL   | cryptoMonPL   | cryptoMonPL   | 0 cryptoMonPL        | cryptoMonPL
	//HPPL          | HPPL          | HPPL          | 1 HPPL               | HPPL
	//status1PL     | status1PL     | status1PL     | 2 status1PL          | status1PL
	//status2PL     | status2PL     | status2PL     | 3 status2PL          | status2PL
	//chargePL      | chargePL      | chargePL      | 4 chargePL           | chargePL
	//cryptoMonOP   | cryptoMonOP   | cryptoMonOP   | 5 cryptoMonOP        | cryptoMonOP
	//HPOP          | HPOP          | HPOP          | 6 HPOP               | HPOP
	//status1OP     | status1OP     | status1OP     | 7 status1OP          | status1OP
	//status2OP     | status2OP     | status2OP     | 8 status2OP          | status2OP
	//chargeOP      | chargeOP      | chargeOP      | 9  chargeOP          | chargeOP
	//              | hashDecision  | hashDecision  | 10 hashDecision      | hashDecision
	//              |               | decisionPL    | 11 decisionPL        | decisionPL
	//              |               | saltPL        | 12 saltPL            | saltPL
	//              |               |               | 13 decisionOP        | decisionOP
	//              |               |               | 14 saltOP            | saltOP
	//              |               |               | 15 nextHashDecision  |
	cryptoMonPL: string,
	cryptoMonPLInstance: ICryptoMon,
	cryptoMonPLData: IPokemonData,
	HPPL: number,
	status1PL: boolean,
	status2PL: boolean,
	chargePL: number,
	cryptoMonOP: string,
	cryptoMonOPInstance: ICryptoMon,
	cryptoMonOPData: IPokemonData,
	HPOP: number,
	status1OP: boolean,
	status2OP: boolean,
	chargeOP: number,
	hashDecision?: string,
	decisionPL?: Move,
	saltPL?: string,
	decisionOP?: Move,
	saltOP?: string,
	nextHashDecision?: string
}


export interface IBattle extends Document {
	_id: string,
		players: [ {
		id: string,
		socket_id: string,
	}, {
		id: string,
		socket_id: string,
	}],
	finished: boolean,
	state: IChannelState,
	prev_state: IChannelState
}

const BattleSchema: Schema = new Schema(
{
		_id: String,
		players: [{
			id: String,
			socket_id: String
		}],
		finished: Boolean,
		state: Object,
		prev_state: Object,
	}
);

export default BattleSchema;