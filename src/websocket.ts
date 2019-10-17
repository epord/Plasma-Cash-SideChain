import { IBlock } from "./models/BlockInterface";
import { Socket } from "socket.io";
import { IBattle, IState } from './models/BattleInterface';
import {
  createBattle,
  getBattleByParticipants,
  getBattleBySocket,
  isTransitionValid,
  isBattleFinished,
  resetAllSockets, disconnectSocket
} from "./services/battle";
import {disconnect} from "cluster";

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
};

const emitError = (socket: Socket, battle: IBattle | undefined, message: String) => {
  if (battle) {
    socket.emit("invalidAction", {state: battle.state, prevState: battle.prev_state, message});
  } else {
    socket.emit("invalidAction", {message})
  }
};

const emitState = (socketId: string, event: string, battle: IBattle) => {
  emitEvent(socketId, event, { state: battle.state, prevState: battle.prev_state})
};


io.on('connection', (socket: Socket) => {
  debug('User connected');

  socket.on("battleRequest", (data: { user: string, opponent: string }) => {
    const { user, opponent } = data;

    debug(`${user} requests a battle with ${opponent}`);

    getBattleByParticipants(user, opponent, (err: any, battle?: IBattle) => {
      // Errors
      if (err) return emitError(socket, battle, 'Error finding battle');
      if (battle && battle.established) return emitError(socket, battle,'This battle already exists');

      if (battle) {
        const player = battle.player1.id == user ? battle.player1 : battle.player2;
        if (player.socket_id) return emitError(socket,battle , 'The battle has already been created. Waiting for opponent');
      }

      if (!battle) {
        // Create battle
        createBattle(user, opponent, socket.id, (err: any, battle?: IBattle) => {
          if (err) {
            console.error(err);
            return emitError(socket, battle, err);
          }

          sockets.set(socket.id, socket);
          emitState(socket.id, 'battleAccepted', battle!);
        });

      } else {

        debug('battle exists');
        sockets.set(socket.id, socket);

        const otherPlayer = battle.player1.id == user ? battle.player2 : battle.player1;

        if (battle.player1.id == user) {
          battle.player1.socket_id = socket.id;
        } else {
          battle.player2.socket_id = socket.id;
        }
        battle.markModified('player1');
        battle.markModified('player2');

        if (otherPlayer.socket_id) {
          // Accept battle
          debug('accept battle');
          battle.established = true;
          battle.save();

          emitState(socket.id, 'battleEstablished', battle!);
          emitState(otherPlayer.socket_id, 'battleEstablished', battle!);
        } else {
          // Reconnect and wait for other player
          debug('Reconnect and wait for other player');

          battle.save();
          emitState(socket.id, 'battleAccepted', battle!);
        }
      }
    });
  });

  socket.on('play', (state: IState) => {
    debug('Player playing with state ', state);

    getBattleBySocket(socket.id, (err: any, battle?: IBattle) => {
      if (err) return emitError(socket, battle, 'Error finding battle');
      if (!battle) return emitError(socket, battle, 'Send connect before play');
      if (!battle.established) return emitError(socket, battle, 'The battle is not established');

      const isPlayer1Turn = battle.state.turnNum % 2 == 1;
      if (
        (isPlayer1Turn && battle.player2.socket_id == socket.id) ||
        (!isPlayer1Turn && battle.player1.socket_id == socket.id)) {
        return emitError(socket, battle, 'Not your turn');
      }

      const valid = isTransitionValid(battle, state);
      if (!valid.result) return emitError(socket, battle, valid.err);

      battle.state = state;
      battle.markModified('state');

      if (isBattleFinished(battle)) {
        battle.finished = true;
        emitEvent(battle.player1.socket_id, 'battleFinished', {state});
        emitEvent(battle.player2.socket_id, 'battleFinished', {state});
      }
      emitEvent(battle.player1.socket_id, 'stateUpdated', { state });
      emitEvent(battle.player2.socket_id, 'stateUpdated', {state});

      battle.save();
    });
  });

  socket.on('debugBattles', (state: any) => {
    debug(sockets.keys());
    BattleService.find({}, console.log)
  });

  socket.on("disconnect", () => {
    debug("Client disconnected")

    disconnectSocket(socket.id);
    sockets.delete(socket.id);
  });
});

export function init(cb: (err: any) => void) {
  const port = process.env.WEBSOCKET_PORT || 4000;
  io.listen(port);
  debug(`Websocket on port ${port}`);

  resetAllSockets(cb);
}