import {ICMBState, ICryptoMon, IPokemonData, IStats, Move, Type} from "../models/BattleInterface";
import {CallBack, Maybe} from "./TypeDef";
import {CryptoUtils} from "./CryptoUtils";
import {BN} from "ethereumjs-util";
import EthUtils = require("ethereumjs-util");
import abi from "ethereumjs-abi";
import RLP = require('rlp');
import {calculateBattle, needsCharge, usesFirstType, usesSecondType} from "./BattleDamageCalculator";
import async = require('async');

function validateTransitionKeepStats(first: IStats, second: IStats): Maybe<boolean> {
    if(!first || !second) return {err: "no stats"};
    if(first.hp !== second.hp) return {err: "hp should stay the same"};
    if(first.atk !== second.atk) return {err: "atk should stay the same"};
    if(first.def !== second.def) return {err: "def should stay the same"};
    if(first.spAtk !== second.spAtk) return {err: "spAtk should stay the same"};
    if(first.spDef !== second.spDef) return {err: "spDef should stay the same"};
    if(first.speed !== second.speed) return {err: "speed should stay the same"};
    return {result: true}
}


function validateTransitionKeepCryptoMon(first: ICryptoMon, second: ICryptoMon): Maybe<boolean> {
    if(!first || !second) return {err: "no CryptmonInstance"};
    if(first.id  !== second.id) return {err: "id should stay the same"};
    if(first.gender  !== second.gender) return {err: "gender should stay the same"};
    if(first.isShiny !== second.isShiny) return {err: "isShiny should stay the same"};
    let errIvs = validateTransitionKeepStats(first.IVs, second.IVs);
    if(!errIvs.result) return {err: "In ivs - " + errIvs.err };
    let errStats = validateTransitionKeepStats(first.stats, second.stats);
    if(!errStats.result) return {err: "In stats - " + errStats.err};

    return {result: true}
}


function validateTransitionKeepPokeData(first: IPokemonData, second: IPokemonData): Maybe<boolean> {
    if(!first || !second) return {err: "no PokemonData"};
    if(first.id !== second.id) return {err: "id should stay the same"};
    if(first.type1 !== second.type1) return {err: "type1 should stay the same"};
    if(first.type2 !== second.type2) return {err: "type2 should stay the same"};
    let errBase = validateTransitionKeepStats(first.base, second.base);
    if(!errBase.result) return {err: "In base - " + errBase.err };

    return {result: true}
}

export function validateTurnTransition(oldState: ICMBState, turnNum: number, newState: ICMBState): Maybe<boolean> {
    let plInstance = validateTransitionKeepCryptoMon(oldState.cryptoMonPLInstance, newState.cryptoMonPLInstance);
    if(!plInstance.result) return {err: "In player instance - " + plInstance.err};
    let opIntance = validateTransitionKeepCryptoMon(oldState.cryptoMonOPInstance, newState.cryptoMonOPInstance);
    if(!opIntance.result) return {err: "In opponent instance - " + opIntance.err};
    let plData = validateTransitionKeepPokeData(oldState.cryptoMonPLData, newState.cryptoMonPLData);
    if(!plData.result) return {err: "In opponent instance - " + plData.err};
    let opData = validateTransitionKeepPokeData(oldState.cryptoMonOPData, newState.cryptoMonOPData);
    if(!opData.result) return {err: "In opponent instance - " + opData.err};

    if(turnNum == 0) {
        return validateInitialTransition(oldState, newState);
    } else if(turnNum%2 == 0) {
        return validateEvenToOdd(oldState, newState, isOver(newState));
    } else {
        return validateOddToEven(oldState, newState, turnNum == 1);
    }
}

function validateTransitionKeepBasics(first: ICMBState, second: ICMBState): Maybe<boolean> {
    //Player
    if(first.cryptoMonPL !== second.cryptoMonPL) return {err:  "Player Cryptomon must stay same" };
    if(first.HPPL        !== second.HPPL) return {err:  "Player HP must stay same" };
    if(first.status1PL   !== second.status1PL) return {err: "Player Status1 must stay same" };
    if(first.status2PL   !== second.status2PL) return {err: "Player Status2 must stay same" };
    if(first.chargePL    !== second.chargePL) return {err:  "Player charges must stay same" };
    //Opponent
    if(first.cryptoMonOP !== second.cryptoMonOP) return {err:  "Opponent Cryptomon must stay same" };
    if(first.HPOP        !== second.HPOP) return {err:  "Opponent HP must stay same" };
    if(first.status1OP   !== second.status1OP) return {err: "Opponent Status1 must stay same" };
    if(first.status2OP   !== second.status2OP) return {err:  "Opponent Status2 must stay same" };
    if(first.chargeOP    !== second.chargeOP) return {err:  "Opponent charges must stay same" };

    return {result: true}
}

function validateInitialTransition(startState: ICMBState, firstTurn: ICMBState): Maybe<boolean> {
    validateTransitionKeepBasics(startState, firstTurn);
    if(!firstTurn.hashDecision) return {err: "Opponent must provide a hash for decision"}
    return {result: true}
}

function validateEvenToOdd(even: ICMBState, odd: ICMBState, isFinal: boolean): Maybe<boolean> {
    if(!isFinal) {
        if(!odd.nextHashDecision) return {err: "Opponent must provide a hash for decision"};
    }

    if(even.cryptoMonPL!==odd.cryptoMonPL) return {err: "Player Cryptomon must stay same"};
    if(even.cryptoMonOP!==odd.cryptoMonOP) return {err: "Opponent Cryptomon must stay same"};
    if(even.hashDecision!==odd.hashDecision) return {err: "hashDecision must stay same"};
    if(even.decisionPL  !==odd.decisionPL   ) return {err: "Player Decision must stay same"};
    if(even.saltPL      !==odd.saltPL      ) return {err: "Player Salt must stay same"};

    if(odd.decisionPL == undefined || typeof odd.decisionPL !== typeof  Move.STATUS2 || odd.decisionPL > Move.STATUS2) return {err: "Players decision invalid"};
    if(odd.decisionOP == undefined || typeof odd.decisionOP !== typeof  Move.STATUS2 || odd.decisionOP > Move.STATUS2) return {err: "Opponent decision invalid"};
    if(!odd.saltOP) return {err: "Opponent must provide the salt"};

    if(even.hashDecision != CryptoUtils.keccak256(
        EthUtils.setLengthLeft(new BN(odd.decisionOP).toBuffer(), 256/8),
        EthUtils.toBuffer(odd.saltOP)
    )) return {err:  "hashDecision is not valid"};


    let state = {
        player: {
            hp: even.HPPL,
            status1: even.status1PL,
            status2: even.status2PL,
            charges: even.chargePL,
            cryptoMon: even.cryptoMonPLInstance,
            data: even.cryptoMonPLData,
            move: odd.decisionPL,
        },
        opponent: {
            hp: even.HPOP,
            status1: even.status1OP,
            status2: even.status2OP,
            charges: even.chargeOP,
            cryptoMon: even.cryptoMonOPInstance,
            data: even.cryptoMonOPData,
            move: odd.decisionOP,
        },
        random: abi.soliditySHA3(['bytes32', 'bytes32'], [odd.saltPL, odd.saltOP]),
    };

    try {
        state = calculateBattle(state);
    }catch (e) {
        return {err: e.message}
    }

    if(state.player.hp      !== odd.HPPL) return {err: "Player HP after battle is incorrect"};
    if(state.player.charges !== odd.chargePL) return {err: "Player charges after battle is incorrect"};
    if(state.player.status1 !== odd.status1PL) return {err: "Player status1 after battle is incorrect"};
    if(state.player.status2 !== odd.status2PL) return {err: "Player status2 after battle is incorrect"};

    if(state.opponent.hp      !== odd.HPOP) return {err: "Player HP after battle is incorrect"};
    if(state.opponent.charges !== odd.chargeOP) return {err: "Player charges after battle is incorrect"};
    if(state.opponent.status1 !== odd.status1OP) return {err: "Player status1 after battle is incorrect"};
    if(state.opponent.status2 !== odd.status2OP) return {err: "Player status2 after battle is incorrect"};

    return {result: true}
}

function validateOddToEven(odd: ICMBState, even: ICMBState, isFirst: boolean): Maybe<boolean> {
    let oddNewHashDec;
    if(isFirst) {
        if(!odd.hashDecision) return {err: "No Hash Decision provided"};
        oddNewHashDec = odd.hashDecision
    } else {

        if(!odd.nextHashDecision) return {err: "No Hash Decision provided"};
        oddNewHashDec = odd.nextHashDecision;
    }
    validateTransitionKeepBasics(odd, even);

    if(oddNewHashDec !==    even.hashDecision) return {err: "Hash decision must stay de same" };

    let playerDecision = even.decisionPL;
    if(playerDecision === undefined || playerDecision > Move.STATUS2) return {err: "Players decision invalid"};

    if(needsCharge(playerDecision) && even.chargePL <= 0) return {err: "Player must have charge to make that move"};

    if(usesFirstType(playerDecision) && even.cryptoMonPLData.type1 == Type.Unknown) return {err: "Player attack cant be done with Unknown type"};
    if(usesSecondType(playerDecision) && even.cryptoMonPLData.type2 == Type.Unknown) return {err: "Player attack cant be done with Unknown type"};

    if(!even.saltPL) return {err : "Player must provide a salt"};

    return {result: true};
}

function winner(state: ICMBState, player: string, opponent: string): string {
    if(state.HPPL > state.HPOP) {
        return player;
    } else {
        return opponent;
    }
}
export const isOver = (state: ICMBState) => {
    return state.HPPL == 0 || state.HPOP == 0;
};

export const toCMBBytes = (state: ICMBState) => {

    let params = [
        new BN(state.cryptoMonPL).toBuffer(),
        new BN(state.HPPL).toBuffer(),
        new BN(booltoInt(state.status1PL)).toBuffer(),
        new BN(booltoInt(state.status2PL)).toBuffer(),
        new BN(state.chargePL).toBuffer(),
        new BN(state.cryptoMonOP).toBuffer(),
        new BN(state.HPOP).toBuffer(),
        new BN(booltoInt(state.status1OP)).toBuffer(),
        new BN(booltoInt(state.status2OP)).toBuffer(),
        new BN(state.chargeOP).toBuffer()
    ];

    if(state.hashDecision != undefined) {
        params.push(EthUtils.toBuffer(state.hashDecision));
        if(state.decisionPL != undefined) {
            params.push(new BN(state.decisionPL).toBuffer());
            params.push(EthUtils.toBuffer(state.saltPL));
            if(state.decisionOP != undefined) {
                params.push(new BN(state.decisionOP).toBuffer());
                params.push(EthUtils.toBuffer(state.saltOP));
                if(state.nextHashDecision != undefined) {
                    params.push(EthUtils.toBuffer(state.nextHashDecision));
                }
            }
        }
    }
    return RLP.encode(params);
};

const booltoInt = (bool: boolean) => {
    if(bool) return 1;
    return 0;
};

export const fromBytes = (bytes: string, done: CallBack<ICMBState>) => {
    const decoded: Buffer[] = RLP.decode(bytes) as Buffer[];

    const tokenPL =  new BN(decoded[0].toString('hex'), 16).toString();
    const tokenOP =  new BN(decoded[5].toString('hex'), 16).toString();

    async.auto({
        tokenPLID: (cb: CallBack<string>) => CryptoUtils.getPlasmaCoinId(tokenPL, cb),
        tokenOPID: (cb: CallBack<string>) => CryptoUtils.getPlasmaCoinId(tokenOP, cb),
        cryptoMonPLInstance: ['tokenPLID', (results: any, cb: CallBack<ICryptoMon>) => CryptoUtils.getCryptomon(results.tokenPLID, cb)],
        cryptoMonOPInstance: ['tokenOPID', (results: any, cb: CallBack<ICryptoMon>) => CryptoUtils.getCryptomon(results.tokenOPID, cb)],
        cryptoMonPLData: ['cryptoMonPLInstance', (results: any, cb: CallBack<IPokemonData>) => CryptoUtils.getPokemonData(results.cryptoMonPLInstance.id, cb)],
        cryptoMonOPData: ['cryptoMonOPInstance', (results: any, cb: CallBack<IPokemonData>) => CryptoUtils.getPokemonData(results.cryptoMonOPInstance.id, cb)],
    }, (err: any, results: any) => {
        if (err) return done(err);
        const game = fromBytesAndData(bytes,
            results.cryptoMonPLInstance,
            results.cryptoMonOPInstance,
            results.cryptoMonPLData,
            results.cryptoMonOPData
        );

        done(null, game);
    });
};

export const fromBytesAndData = (
    bytes: string,
    cryptoMonPLInstance: ICryptoMon,
    cryptoMonOPInstance: ICryptoMon,
    cryptoMonPLData: IPokemonData,
    cryptoMonOPData: IPokemonData
    ): ICMBState => {

    const decoded: Buffer[] = RLP.decode(bytes) as Buffer[];

    const tokenPL =  new BN(decoded[0].toString('hex'), 16).toString();
    const tokenOP =  new BN(decoded[5].toString('hex'), 16).toString();

    let game: ICMBState = {
        cryptoMonPL: tokenPL,
        cryptoMonPLInstance: cryptoMonPLInstance,
        cryptoMonPLData: cryptoMonPLData,
        HPPL: parseInt(decoded[1].toString('hex'), 16),
        status1PL: Boolean(parseInt(decoded[2].toString('hex'), 16)),
        status2PL: Boolean(parseInt(decoded[3].toString('hex'), 16)),
        chargePL: parseInt(decoded[4].toString('hex'), 16),
        cryptoMonOP: tokenOP,
        cryptoMonOPInstance: cryptoMonOPInstance,
        cryptoMonOPData: cryptoMonOPData,
        HPOP: parseInt(decoded[6].toString('hex'), 16),
        status1OP: Boolean(parseInt(decoded[7].toString('hex'), 16)),
        status2OP: Boolean(parseInt(decoded[8].toString('hex'), 16)),
        chargeOP: parseInt(decoded[9].toString('hex'), 16)
    };

    if (decoded.length > 10) {
        game.hashDecision = '0x' + decoded[10].toString('hex');
        if (decoded.length > 11) {
            game.decisionPL = parseInt(decoded[11].toString('hex'), 16);
            game.saltPL = '0x' + decoded[12].toString('hex');
            if (decoded.length > 13) {
                game.decisionPL = parseInt(decoded[13].toString('hex'), 16);
                game.saltOP = '0x' + decoded[14].toString('hex');
                if (decoded.length > 15) {
                    game.nextHashDecision = '0x' + decoded[15].toString('hex');
                }
            }
        }
    }

    return game;
};