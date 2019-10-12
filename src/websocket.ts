
const debug = require('debug')('app:websockets');
const express = require('express');
const app = express();
const http = require("http").Server(app);
let io = require("socket.io")(http);

// TODO: persist in DB
interface IState {
  turn: number
};
interface IBattle {
  player1: { id: string, socket: any },
  player2: { id: string, socket: any | undefined },
  established: boolean,
  finished: boolean,
  state: IState,
};
let battles: IBattle[] = [];

function isTransitionValid (battle: IBattle, newState: any) {
  const oldState = battle.state;
  return !battle.finished && parseInt('' + oldState.turn) + 1 == newState.turn;
}

function isBattleFinished (battle: IBattle) {
  return battle.state.turn == 5;
}

io.on('connection', (socket: any) => {
  debug('User connected');
  debug(battles)

  socket.on("battleRequest", (data: { user: string, opponent: string }) => {
    const { user, opponent } = data;
    debug(`${user} requests a battle with ${opponent}`)

    const battle: IBattle | undefined = battles.find(b => (
      (b.player1.id == user && b.player1.socket == socket && b.player2.id == opponent)
      || (b.player1.id == opponent && b.player2.id == user)
    ));

    // Errors
    if (battle && battle.established) {
      return socket.emit('invalidAction', { message: 'This battle already exists' });
    }
    if (battle && battle.player1.id == user) {
      return socket.emit('invalidAction', { message: 'The battle has already been created. Waiting for opponent' });
    }

    if (!battle) {
      // Create battle
      const newBattle: IBattle = {
        player1: { id: user, socket },
        player2: { id: opponent, socket: undefined },
        established: false,
        finished: false,
        state: { turn: parseInt('0') },
      };
      battles.push(newBattle);
      return socket.emit('battleAccepted');
    } else {
      // Accept battle
      battle.player2.socket = socket;
      battle.established = true;
      battle.player1.socket.emit('battleEstablished');
      socket.emit('battleEstablished');
    }
  });

  socket.on('play', (state: any) => {
    debug('Player playing with state ', state)

    const battle: IBattle | undefined = battles.find(b => b.player1.socket == socket || b.player2.socket == socket);
    if (!battle || !battle.established) {
      return socket.emit('invalidAction', { message: 'Couldn\'t find any battle' });
    }

    const isPlayer1Turn = battle.state.turn % 2 == 0;
    if ((isPlayer1Turn && battle.player2.socket == socket) || (!isPlayer1Turn && battle.player1.socket == socket)) {
      return socket.emit('invalidAction', { message: 'Not your turn', state });
    }
    if (!isTransitionValid(battle, state)) {
      return socket.emit('invalidAction', { message: 'Invalid transition', state: battle.state });
    }

    battle.state = state;

    if (isBattleFinished(battle)) {
      battle.finished = true;
      battle.player1.socket.emit('battleFinished', state);
      battle.player2.socket.emit('battleFinished', state);
    } else {
      battle.player1.socket.emit('stateUpdated', state);
      battle.player2.socket.emit('stateUpdated', state);
    }
  });

  socket.on('debugBattles', (state: any) => {
    debug(battles);
  });

  socket.on("disconnect", () => {
    debug("Client disconnected")
    battles = battles.filter(b => b.player1.socket != socket && b.player2.socket != socket);
  });
});

export function init(cb: () => void) {
  const port = process.env.WEBSOCKET_PORT || 4000;
  io.listen(port);
  debug(`Websocket on port ${port}`);
  cb();
}