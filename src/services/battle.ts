import { BattleService } from './index';
import { CallBack } from '../utils/TypeDef';
import { IBattle } from '../models/BattleInterface';


export const getBattleBySocket = (socketId: String, cb: CallBack<IBattle>) => {
  BattleService.findOne({
    $or: [{
      "player1.socket_id": socketId,
    }, {
      "player2.socket_id": socketId
    }
  ]}, cb);
}