import { BattleService } from './index';
import {CallBack, Maybe} from '../utils/TypeDef';
import {IBattle, IState} from '../models/BattleInterface';
import {getInitialRPSState, isRPSBattleFinished, validateRPSTransition} from "../utils/RPSExample";
const _ = require('lodash');
const debug = require('debug')('app:battles');


export const getBattleBySocket = (socketId: String, cb: CallBack<IBattle>) => {
  BattleService.findOne({
    $or: [{
      "player1.socket_id": socketId,
    }, {
      "player2.socket_id": socketId
    }
  ]}, cb);
};

export const getBattleByParticipants = (player1: string, player2: string, cb: CallBack<IBattle>) => {
  BattleService.findOne({
    finished: false,
    $or: [{ "player1.id": player1, "player2.id": player2 },
      { "player1.id": player2, "player2.id": player1 }]
  }, cb);
};

export const resetAllSockets = (cb: CallBack<void>) => {
  BattleService.updateMany({}, {
    $set: {
      "player1.socket_id": undefined,
      "player2.socket_id": undefined,
      established: false,
    }
  }, cb);
};

export const disconnectSocket = (socketId: string) => {
  BattleService.updateMany({
    "player1.socket_id": socketId
  }, {
    $set: {
      "player1.socket_id": undefined,
      established: false,
    }
  }, _.noop);
  BattleService.updateMany({
    "player2.socket_id": socketId
  }, {
    $set: {
      "player2.socket_id": undefined,
      established: false,
    }
  }, {
    multi: true
  }, _.noop);
};

export function isTransitionValid (battle: IBattle, newState: IState): Maybe<boolean> {
  const oldState = battle.state;

  if(oldState.channelId != newState.channelId) return { err: "channelId change" };
  if(oldState.channelType != newState.channelType) return { err: "channelType change" };
  if(oldState.participants.length != newState.participants.length) return { err: "participants must stay the same "};
  if(oldState.participants[0] != newState.participants[0]) return { err: "Player must stay the same "};
  if(oldState.participants[1] != newState.participants[1]) return { err: "Opponent must stay the same "};
  if(oldState.turnNum + 1 != newState.turnNum) return { err: "TurnNum should be increased by 1"};
  //TODO validate gameAttributes are ok and signed

  return validateRPSTransition(oldState.turnNum, oldState.game, newState.game);
}

export function isBattleFinished (battle: IBattle) {
  return isRPSBattleFinished(battle.state.game);
}

export function getInitialState(channelId: string, player: string, opponent: string): IState {
  return {
    channelId,
    channelType: '',
    participants: [player, opponent],
    turnNum: 0,
    gameAttributes: '',
    game: getInitialRPSState(),
  }
}

export const createBattle = (player: string, opponent: string, playerSocketId: string, cb: CallBack<IBattle>) => {

  // Create battle
  debug('create battle');

  BattleService.create({
    player1: { id: player, socket_id: playerSocketId },
    player2: { id: opponent },
    established: false,
    finished: false,
    state: getInitialState('0', player, opponent),
  }, cb);

};