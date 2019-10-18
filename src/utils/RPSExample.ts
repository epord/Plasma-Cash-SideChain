import {IRPSExample, IState} from "../models/BattleInterface";
import {Maybe} from "./TypeDef";
import {CryptoUtils} from "./CryptoUtils";
import EthUtils = require("ethereumjs-util");
import {BN} from "ethereumjs-util";
import RLP = require("rlp");

export const validateRPSTransition = (turnNum: number, oldState: IRPSExample, newState: IRPSExample): Maybe<boolean> => {
    if(turnNum == 0) {
        return validateInitialTransition(oldState, newState);
    } else if(turnNum%2 == 0) {
        return validateEvenToOdd(oldState, newState, isRPSBattleFinished(newState));
    } else {
        return validateOddToEven(oldState, newState, turnNum == 1);
    }
};

const validateInitialTransition = (start: IRPSExample, first: IRPSExample): Maybe<boolean> => {
    if(start.gamesToPlay != first.gamesToPlay) return {err: "GamesToPlay should not change on first turn"};
    if(start.scorePL != first.scorePL) return {err: "ScorePL should not change on first turn"};
    if(start.scoreOP != first.scoreOP) return {err: "ScoreOP should not change on first turn"};
    if(!first.hashDecision || first.hashDecision!.length != 2+32*2) return {err: "Invalid Hash decision"};

    return {result: true};
};

const validateEvenToOdd = (even: IRPSExample, odd: IRPSExample, isFinal: boolean): Maybe<boolean> => {
    if(even.hashDecision != odd.hashDecision) return {err:  "HashDecision should not change"};
    if(odd.decisionOP  == undefined || odd.decisionOP < 0 || odd.decisionOP >= 3) return {err:  "Invalid Opponent decision"};
    if(!odd.salt) return {err: "No salt provided"};

    if(even.hashDecision != CryptoUtils.keccak256(
        EthUtils.setLengthLeft(new BN(odd.decisionOP!).toBuffer(), 256/8),
        EthUtils.toBuffer(odd.salt!)
    )) return {err:  "HashDecision is not valid"};

    if(even.decisionPL != odd.decisionPL) return {err:  "PLayer decision should not change"};

    if(odd.decisionPL == odd.decisionOP) {
        if(even.gamesToPlay != odd.gamesToPlay) return { err: "GamesToPlay does not go down on draw" };
        if(even.scorePL != odd.scorePL) return { err: "Player Score does not increase on draw" };
        if(even.scoreOP != odd.scoreOP) return { err: "Opponent Score does not increase on draw" };
    } else if(
        (odd.decisionPL == 0  && odd.decisionOP == 2) ||
        (odd.decisionPL == 1  && odd.decisionOP == 0) ||
        (odd.decisionPL == 2  && odd.decisionOP == 1)
    ) {
        if(even.gamesToPlay != odd.gamesToPlay + 1) return {err:  "GamesToPlay should decrease"};
        if(even.scorePL + 1 != odd.scorePL) return {err:  "Player Score increases due to win"};
        if(even.scoreOP != odd.scoreOP) return {err:  "Opponent Score must say the same due to loss"};
    } else {
        if(even.gamesToPlay != odd.gamesToPlay + 1) return { err: "GamesToPlay should decrease"};
        if(even.scorePL != odd.scorePL) return { err: "Player Score must  say the same due to loss"};
        if(even.scoreOP + 1 != odd.scoreOP) return { err: "Opponent Score increases due to win"};
    }

    if(!isFinal) {
        if(!odd.nextHashDecision || odd.nextHashDecision!.length != 2+32*2) return {err: "Invalid next Hash decision"};
    }

    return {result: true};
};

const validateOddToEven = (odd: IRPSExample, even: IRPSExample, isFirst: boolean): Maybe<boolean> => {
    let oddNewHashDec: string;
    if(isFirst) {
        oddNewHashDec = odd.hashDecision!;
    } else {
        oddNewHashDec = odd.nextHashDecision!;
    }

    if(even.gamesToPlay != odd.gamesToPlay) return { err: "GamesToPlay must stay de same"};
    if(even.scorePL != odd.scorePL) return {err:  "Player score must stay de same"};
    if(even.scoreOP != odd.scoreOP) return {err:  "Opponent score must stay de same"};
    if(even.hashDecision != oddNewHashDec) return {err:  "Hash decision must stay de same"};
    if(even.decisionPL == undefined || even.decisionPL < 0 || even.decisionPL >= 3) return {err:  "Player decision must be 0, 1 or 2"};

    return { result: true };
};


export const isRPSBattleFinished = (state: IRPSExample): boolean => {
    return state.gamesToPlay == 0;
};


export const getInitialRPSState = (gamesToPlay: number): IRPSExample => {
    return {
        gamesToPlay: gamesToPlay,
        scoreOP: 0,
        scorePL: 0,
    }
}

export const toBytes = (state: IRPSExample) => {
    let params = [
        //TODO check if this can be less than 256 (using other than toUint() in solidity. Maybe to Address())?
        EthUtils.setLengthLeft(new BN(state.gamesToPlay).toBuffer(), 256/8), 			// uint256 little endian
        EthUtils.setLengthLeft(new BN(state.scorePL).toBuffer(), 256/8), 			// uint256 little endian
        EthUtils.setLengthLeft(new BN(state.scoreOP).toBuffer(), 256/8), 			// uint256 little endian
    ];

    if(state.hashDecision != undefined) {
        params.push(EthUtils.toBuffer(state.hashDecision));
        if(state.decisionPL != undefined) {
            params.push(EthUtils.setLengthLeft(new BN(state.decisionPL).toBuffer(), 256/8));
            if(state.decisionOP != undefined) {
                params.push(EthUtils.setLengthLeft(new BN(state.decisionOP).toBuffer(), 256/8));
                params.push(EthUtils.toBuffer(state.salt));
                if(state.nextHashDecision != undefined) {
                    params.push(EthUtils.toBuffer(state.nextHashDecision));
                }
            }
        }
    }

    return RLP.encode(params);
};