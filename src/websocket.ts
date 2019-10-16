import { IBlock } from "./models/BlockInterface";
import { Socket } from "socket.io";
import { IBattle, IState } from './models/BattleInterface';
import { getBattleBySocket } from "./services/battle";
import {Maybe} from "./utils/TypeDef";
import {isRPSBattleFinished, validateRPSTransition} from "./utils/RPSExample";

const debug = require('debug')('app:websockets');
const _ = require('lodash');
const express = require('express');
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const { BattleService } = require('./services');

// sockets: socketId -> Socket
const sockets = new Map<String,Socket>();

const emitEvent = (socketId: string, event: string, ...args: any[]) => {
  const socket = sockets.get(socketId);
  if (socket) socket.emit(event, ...args);
}

function isTransitionValid (battle: IBattle, newState: IState): Maybe<boolean> {
  const oldState = battle.state;

  if(oldState.channelId != newState.channelId) return { err: "channelId change" };
  if(oldState.channelType != newState.channelType) return { err: "channelType change" };
  if(oldState.participants.length != newState.participants.length) return { err: "participants must stay the same "};
  if(oldState.participants[0] != newState.participants[0]) return { err: "Player must stay the same "};
  if(oldState.participants[1] != newState.participants[1]) return { err: "Opponent must stay the same "};
  if(oldState.turnNum != newState.turnNum + 1) return { err: "TurnNum should be increased by 1"};
  //TODO validate gameAttributes are ok and signed

  return validateRPSTransition(oldState.turnNum, oldState.game, newState.game);
}

function isBattleFinished (battle: IBattle) {
  return isRPSBattleFinished(battle.state.game);
}

io.on('connection', (socket: Socket) => {
  debug('User connected');

  socket.on("battleRequest", (data: { user: string, opponent: string }) => {
    const { user, opponent } = data;
    debug(`${user} requests a battle with ${opponent}`)

    BattleService.findOne({
      $or: [{
        "player1.id": user,
        "player2.id": opponent
      },
      {
        "player1.id": opponent,
        "player2.id": user
      }]
    }, (err: any, battle: IBattle) => {
      // Errors
      if (err) {
        return socket.emit('invalidAction', { message: 'Error finding battle' });
      }
      if (battle && battle.established) {
        // TODO: reconnect user
        return socket.emit('invalidAction', { message: 'This battle already exists' });
      }
      if (battle && battle.player1.id == user) {
        return socket.emit('invalidAction', { message: 'The battle has already been created. Waiting for opponent' });
      }

      if (!battle) {
        // Create battle
        debug('create battle')
        BattleService.create({
          player1: { id: user, socket_id: socket.id },
          player2: { id: opponent },
          established: false,
          finished: false,
          state: { turn: 0 },
        }, (err: any, battle: IBattle) => {
          if (err) {
            console.error(err);
            return socket.emit('invalidAction', { message: err });
          }
          sockets.set(socket.id, socket);
          socket.emit('battleAccepted', { state: battle.state });
        });
      } else {
        // Accept battle
        debug('battle exists')
        battle.established = true;
        battle.player2.socket_id = socket.id;
        battle.markModified('player2');
        battle.save();

        sockets.set(socket.id, socket);

        emitEvent(battle.player1.socket_id, 'battleEstablished', { state: battle.state });
        emitEvent(battle.player2.socket_id, 'battleEstablished', { state: battle.state });
      }
    });
  });

  socket.on('play', (state: IState) => {
    debug('Player playing with state ', state)

    getBattleBySocket(socket.id, (err: any, battle?: IBattle) => {
      if (err) {
        return socket.emit('invalidAction', { message: 'Error finding battle' });
      }
      if (!battle) {
        return socket.emit('invalidAction', { message: 'Send connect before play' });
      }
      if (!battle.established) {
        return socket.emit('invalidAction', { message: 'The battle hasn\'t been established' });
      }
      const isPlayer1Turn = battle.state.turnNum % 2 == 0;
      if (
        (isPlayer1Turn && battle.player2.socket_id == socket.id) ||
        (!isPlayer1Turn && battle.player1.socket_id == socket.id)) {
        return socket.emit('invalidAction', { message: 'Not your turn', state: battle.state });
      }
      if (!isTransitionValid(battle, state)) {
        return socket.emit('invalidAction', { message: 'Invalid transition', state: battle.state });
      }

      battle.state = state;
      battle.markModified('state');

      if (isBattleFinished(battle)) {
        battle.finished = true;
        emitEvent(battle.player1.socket_id, 'battleFinished', state);
        emitEvent(battle.player2.socket_id, 'battleFinished', state);
      } else {
        emitEvent(battle.player1.socket_id, 'stateUpdated', state);
        emitEvent(battle.player2.socket_id, 'stateUpdated', state);
      }

      battle.save();
    });
  });

  socket.on('debugBattles', (state: any) => {
    debug(sockets.keys());
    BattleService.find({}, console.log)
  });

  socket.on("disconnect", () => {
    debug("Client disconnected")

    BattleService.updateMany({
      "player1.socket_id": socket.id
    }, {
      $set: { "player1.socket_id": undefined }
    }, _.noop);
    BattleService.updateMany({
      "player2.socket_id": socket.id
    }, {
      $set: { "player2.socket_id": undefined }
    }, {
      multi: true
    }, _.noop);

    sockets.delete(socket.id);
  });
});

export function init(cb: () => void) {
  const port = process.env.WEBSOCKET_PORT || 4000;
  io.listen(port);
  debug(`Websocket on port ${port}`);
  cb();
}