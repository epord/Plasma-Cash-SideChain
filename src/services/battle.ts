import { BattleService } from './index';
import { CallBack, Maybe } from '../utils/TypeDef';
import { IBattle, IState } from '../models/BattleInterface';
import { getInitialRPSState, isRPSBattleFinished, validateRPSTransition } from "../utils/RPSExample";
import { CryptoUtils } from '../utils/CryptoUtils';
import { recover } from "../utils/sign";
import { emitState } from '../websocket';

const _ = require('lodash');
const debug = require('debug')('app:battles');

export const getBattleById = (channelId: string, cb: CallBack<IBattle>) => {
  BattleService.findById(channelId, cb);
}

export function mover(state: IState) {
  return state.participants[state.turnNum % 2];
}

export function isTransitionValid (battle: IBattle, newState: IState): Maybe<boolean> {
  const oldState = battle.state;

  if(oldState.channelId != newState.channelId) return { err: "channelId change" };
  if(oldState.channelType != newState.channelType) return { err: "channelType change" };
  if(oldState.participants.length != newState.participants.length) return { err: "participants must stay the same "};
  if(oldState.participants[0] != newState.participants[0]) return { err: "Player must stay the same "};
  if(oldState.participants[1] != newState.participants[1]) return { err: "Opponent must stay the same "};
  if(oldState.turnNum + 1 != newState.turnNum) return { err: "TurnNum should be increased by 1"};

  if(!newState.signature) return {err: "Missing siganture"};
  // try {
    const pubAddress = CryptoUtils.pubToAddress(recover(CryptoUtils.hashChannelState(newState), newState.signature));
    console.log('pubAddress');
    console.log(pubAddress);
    if (mover(newState).toLowerCase() !== pubAddress) return {err: "Invalid Signature"};
  // } catch (e) {
  //   console.error(e.message);
  //   return {err: "Invalid Signature"}
  // }

  return validateRPSTransition(oldState.turnNum, oldState.game, newState.game);
}

export function isBattleFinished (battle: IBattle) {
  return isRPSBattleFinished(battle.state.game);
}

export function getInitialState(channelId: string, channelType: string, gamesToPlay: number,  player: string, opponent: string): IState {
  return {
    channelId,
    channelType: channelType,
    participants: [player, opponent],
    turnNum: 0,
    game: getInitialRPSState(gamesToPlay),
  }
}

export const createBattle = (
  channelId: string,
  channelType: string,
  gamesToPlay: number,
  player: string,
  opponent: string,
  cb: CallBack<IBattle>) => {

  // Create battle
  debug('create battle');

  BattleService.create({
    _id: channelId,
    players: [{ id: player } , { id: opponent }],
    finished: false,
    state: getInitialState(channelId, channelType, gamesToPlay, player, opponent),
  }, cb);
};

export const play = (state: IState, battle: IBattle, cb: CallBack<IBattle>) => {

  console.log('play', state, battle._id)

  const valid = isTransitionValid(battle, state);
  if (!valid.result) return cb(valid.err);

  battle.prev_state = battle.state;
  battle.state = state;
  battle.markModified('state');
  battle.markModified('prev_state');

  emitState(battle.players[0].socket_id, 'stateUpdated', battle);
  emitState(battle.players[1].socket_id, 'stateUpdated', battle);

  if (isBattleFinished(battle)) {
    battle.finished = true;
    emitState(battle.players[0].socket_id, 'battleFinished', battle);
    emitState(battle.players[1].socket_id, 'battleFinished', battle);
  }

  battle.save(cb);
}