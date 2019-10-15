import { IBlock } from "./models/BlockInterface";
import { Socket } from "socket.io";
import { IBattle, IState } from './models/BattleInterface';
import { getBattleBySocket } from "./services/battle";

const debug = require('debug')('app:websockets');
const express = require('express');
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const { BattleService } = require('./services');


// TODO: persist in DB
// interface IState {
//   turn: number
// };
// interface IBattle {
//   player1: { id: string, socket: any },
//   player2: { id: string, socket: any | undefined },
//   established: boolean,
//   finished: boolean,
//   state: IState,
// };
// let sockets: IBattle[] = [];

// sockets: socketId -> Scoket
const sockets = new Map<String,Socket>();

function isTransitionValid (battle: IBattle, newState: IState) {
  const oldState = battle.state;
  return !battle.finished && parseInt('' + oldState.turn) + 1 == newState.turn;
}

function isBattleFinished (battle: IBattle) {
  return battle.state.turn == 5;
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

        const socketPlayer1 = sockets.get(battle.player1.socket_id);
        const socketPlayer2 = sockets.get(battle.player2.socket_id);
        if (socketPlayer1) socketPlayer1.emit('battleEstablished', { state: battle.state });
        if (socketPlayer2) socketPlayer2.emit('battleEstablished', { state: battle.state });
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
      const isPlayer1Turn = battle.state.turn % 2 == 0;
      if (
        (isPlayer1Turn && battle.player2.socket_id == socket.id) ||
        (!isPlayer1Turn && battle.player1.socket_id == socket.id)) {
        return socket.emit('invalidAction', { message: 'Not your turn', state });
      }
      if (!isTransitionValid(battle, state)) {
        return socket.emit('invalidAction', { message: 'Invalid transition', state: battle.state });
      }

      battle.state = state;
      battle.markModified('state');
      const socketPlayer1 = sockets.get(battle.player1.socket_id);
      const socketPlayer2 = sockets.get(battle.player2.socket_id);

      if (isBattleFinished(battle)) {
        battle.finished = true;
        if (socketPlayer1) socketPlayer1.emit('battleFinished', state);
        if (socketPlayer2) socketPlayer2.emit('battleFinished', state);
      } else {
        if (socketPlayer1) socketPlayer1.emit('stateUpdated', state);
        if (socketPlayer2) socketPlayer2.emit('stateUpdated', state);
      }

      battle.save()
    });
  });

  // socket.on('debugBattles', (state: any) => {
  //   debug(sockets);
  // });

  socket.on("disconnect", () => {
    debug("Client disconnected")
    // TODO: remove things
  });
});

export function init(cb: () => void) {
  const port = process.env.WEBSOCKET_PORT || 4000;
  io.listen(port);
  debug(`Websocket on port ${port}`);
  cb();
}