import {BattleService} from '.';
import {CallBack, Maybe} from '../utils/TypeDef';
import {CryptoUtils} from '../utils/CryptoUtils';
import {recover} from "../utils/sign";
import {emitState} from '../websocket';
import {isOver, validateTurnTransition} from '../utils/CryptoMonBattles';
import {IBattle, IChannelState, ICMBState} from "../models/battle";

const _ = require('lodash');
const debug = require('debug')('app:battles');

export class Battle {
  public static getById = (channelId: string, cb: CallBack<IBattle>) => {
    BattleService.findById(channelId, cb);
  };

  public static mover(state: IChannelState) {
    return state.participants[state.turnNum % 2];
  }

  public static isTransitionValid(battle: IBattle, newState: IChannelState): Maybe<boolean> {
    const oldState = battle.state;

    if (oldState.channelId != newState.channelId) return {err: "channelId change"};
    if (oldState.channelType != newState.channelType) return {err: "channelType change"};
    if (oldState.participants.length != newState.participants.length) return {err: "participants must stay the same "};
    if (oldState.participants[0] != newState.participants[0]) return {err: "Player must stay the same "};
    if (oldState.participants[1] != newState.participants[1]) return {err: "Opponent must stay the same "};
    if (oldState.turnNum + 1 != newState.turnNum) return {err: "TurnNum should be increased by 1"};

    if (!newState.signature) return {err: "Missing siganture"};

    try {
      const pubAddress = CryptoUtils.pubToAddress(recover(CryptoUtils.hashChannelState(newState), newState.signature));
      if (Battle.mover(newState).toLowerCase() !== pubAddress) return {err: "Invalid Signature"};
    } catch (e) {
      console.error(e.message);
      return {err: "Invalid Signature"}
    }

    return validateTurnTransition(oldState.game, oldState.turnNum, newState.game);
  }

  public static isFinished(battle: IBattle) {
    return isOver(battle.state.game);
  }

  public static create = (
      channelId: string,
      channelType: string,
      player: string,
      opponent: string,
      initialState: ICMBState,
      cb: CallBack<IBattle>) => {

    // Create battle
    debug('create battle');

    BattleService.create({
      _id: channelId,
      players: [{id: player}, {id: opponent}],
      finished: false,
      state: {
        channelId,
        channelType,
        participants: [player, opponent],
        turnNum: 0,
        game: initialState
      },
    }, cb);
  };

  public static play = (state: IChannelState, battle: IBattle, cb: CallBack<IBattle>) => {
    const valid = Battle.isTransitionValid(battle, state);
    if (!valid.result) return cb(valid.err);

    battle.prev_state = battle.state;
    battle.state = state;
    battle.markModified('state');
    battle.markModified('prev_state');

    emitState(battle.players[0].socket_id, 'stateUpdated', battle);
    emitState(battle.players[1].socket_id, 'stateUpdated', battle);

    if (Battle.isFinished(battle)) {
      battle.finished = true;
      emitState(battle.players[0].socket_id, 'battleFinished', battle);
      emitState(battle.players[1].socket_id, 'battleFinished', battle);
    }

    battle.save(cb);
  }
}