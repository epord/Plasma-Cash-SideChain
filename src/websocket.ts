import { IBlock } from "./models/BlockInterface";
import { Socket } from "socket.io";
import { IBattle, IState } from './models/BattleInterface';
import {
  isTransitionValid,
  isBattleFinished,
  getBattleById
} from "./services/battle";
import { disconnect } from "cluster";
import { Utils } from "./utils/Utils";
import { CryptoUtils } from "./utils/CryptoUtils";
import { recover } from "./utils/sign";
import { CallBack } from "./utils/TypeDef";
import { play } from './services/battle';

const debug = require('debug')('app:websockets');
const _ = require('lodash');
const express = require('express');
const app = express();
const http = require("http").Server(app);
const io = require("socket.io")(http);

const { BattleService } = require('./services');

// sockets: socketId -> Socket
interface ISocketState {
  socket: Socket,
  owner: string,
  authenticated: boolean,
  nonce: string,
}
const sockets = new Map<String, ISocketState>();

const emitEvent = (socketId: string, event: string, ...args: any[]) => {
  const socketState = sockets.get(socketId);
  if (socketState) socketState.socket.emit(event, ...args);
};

const emitError = (socket: Socket, battle: IBattle | undefined, message: String) => {
  if (battle) {
    socket.emit("invalidAction", { state: battle.state, prevState: battle.prev_state, message });
  } else {
    socket.emit("invalidAction", { message })
  }
};

export const emitState = (socketId: string, event: string, battle: IBattle) => {
  emitEvent(socketId, event, { state: battle.state, prevState: battle.prev_state })
};
const isAuthenticated = (socketId: string) => {
  return sockets.get(socketId)!.authenticated;
};

const onAuthentication = (socket: Socket) => {
  socket.on("authenticationResponse", (data: { user: string, signature: string }) => {
    debug('Response of authentication ', data.user)

    const socketState = sockets.get(socket.id);
    if (!socketState) return emitError(socket, undefined, "No connection registered");

    try {
      debug('recovering address')
      debug('address recovered')
      const pubAddress = CryptoUtils.pubToAddress(recover(socketState.nonce, data.signature));
      if (data.user.toLowerCase() !== pubAddress) return emitError(socket, undefined, 'Validation failed');
    } catch (e) {
      console.error(e.message);
      return emitError(socket, undefined, 'Validation failed');
    }

    socketState.owner = data.user;
    socketState.authenticated = true;
    sockets.set(socket.id, socketState);
    debug("Client authenticated");
    socket.emit("authenticated");
  });
};

const updateSocketIdIfNeeded = (channelId: string, socketId: string, cb: CallBack<IBattle>) => {
  getBattleById(channelId, (err: any, battle?: IBattle) => {
    // Errors
    if (err) {
      debug("ERROR Finding battle: ", err);
      return cb('Error while finding battle');
    }
    if (!battle) return cb('Battle has not been started');

    const socketState = sockets.get(socketId);
    if (!socketState) return cb('Authenticate first');

    const user = socketState.owner;
    let playerIndex = battle.players.findIndex(u => u.id.toLowerCase() == user.toLowerCase());
    if (playerIndex < 0) return cb('This socket is not participating of this battle');

    if(battle.finished) return cb('Battle is finished', battle)

    if (battle.players[playerIndex].socket_id != socketId) {
      battle.players[playerIndex].socket_id = socketId;
      battle.markModified('players');
      battle.save(cb)
    } else {
      cb(null, battle);
    }
  })
};

const onBattleRequest = (socket: Socket) => {
  socket.on("battleRequest", (data: { channelId: string }) => {
    const { channelId } = data;

    if (!isAuthenticated(socket.id)) return emitError(socket, undefined, "Not authenticated");

    debug(`${channelId} requests a battle`);

    updateSocketIdIfNeeded(channelId, socket.id, (err: any, battle?: IBattle) => {
      if(err) return emitError(socket, battle, err);

      const socket1 = battle!.players[0].socket_id;
      const socket2 = battle!.players[1].socket_id;

      if (socket1 && socket2) {
        emitState(socket1, 'battleEstablished', battle!);
        emitState(socket2, 'battleEstablished', battle!);
      } else {
        emitState(socket.id, 'battleAccepted', battle!);
      }
    });
  });
};

const onPlay = (socket: Socket) => {
  socket.on('play', (state: IState) => {
    debug('Player playing with state ', state);
    if(!isAuthenticated(socket.id)) return emitError(socket, undefined, "Not authenticated");

    updateSocketIdIfNeeded(state.channelId, socket.id, (err: any, battle?: IBattle) => {
      if (err) return emitError(socket, battle, err);

      battle = battle!
      const isPlayer1Turn = battle.state.turnNum % 2 == 0;
      if (
        (isPlayer1Turn && battle.players[0].socket_id == socket.id) ||
        (!isPlayer1Turn && battle.players[1].socket_id == socket.id)) {
        return emitError(socket, battle, 'Not your turn');
      }
      play(state, battle, (err: any) => {
        if (err) return emitError(socket, battle, err);
      })
    });
  });
};

const onDisonnect = (socket: Socket) => {
  socket.on("disconnect", () => {
    debug("Client disconnected")

    sockets.delete(socket.id);
  });
};

io.on('connection', (socket: Socket) => {
  debug('User connected');

  const socketState = { socket: socket, nonce: "0x00000000000000000000000000000000" + Utils.randomHex256().slice(2,34), authenticated: false, owner: "" };
  sockets.set(socket.id, socketState);

  onBattleRequest(socket);
  onPlay(socket);
  onDisonnect(socket);
  onAuthentication(socket);

  socket.on('debugBattles', (state: any) => {
    debug(sockets.keys());
    BattleService.find({}, console.log)
  });

  socket.emit("authenticationRequest", { nonce: socketState.nonce })

});

export function init(cb: (err: any) => void) {
  const port = process.env.WEBSOCKET_PORT || 4000;
  io.listen(port);
  debug(`Websocket on port ${port}`);

}