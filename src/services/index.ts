import CoinStateSchema, {ICoinState} from "../models/coinStateModel";
import mongoose from "mongoose";
import TransactionSchema, {ITransaction} from "../models/transaction";
import BlockSchema, {IBlock} from "../models/block";
import SecretRevealingBlockSchema, {ISRBlock} from "../models/secretRevealingBlock";
import BattleSchema, {IBattle} from "../models/battle";

export const TransactionService = mongoose.model<ITransaction>('Transaction', TransactionSchema, 'transactions');
export const BlockService = mongoose.model<IBlock>('Block', BlockSchema, 'blocks');
export const SecretRevealingBlockService = mongoose.model<ISRBlock>('SecretRevealingBlock', SecretRevealingBlockSchema, 'secretRevealingBlocks');
export const BattleService = mongoose.model<IBattle>('Battle', BattleSchema, 'battles');
export const CoinStateService = mongoose.model<ICoinState>('CoinState', CoinStateSchema, 'coinStates');

