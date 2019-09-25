import BigNumber from "bignumber.js";
import {IJSONTransaction, ITransaction} from "./TransactionInterface";
import {CallBack} from "../utils/TypeDef";

export interface IBlock {

    block_number: BigNumber;

    root_hash: string;

    timestamp: Date;

    transactions: Array<string>;
    Transactions: Array<ITransaction>;

    save: (cb?: CallBack<IBlock>) => void;
    populate: (field: string, cb: CallBack<IBlock>) => void;
}

export interface IJSONBlock {
    blockNumber: string,
    rootHash: string,
    timestamp: string,
    transactions: IJSONTransaction[]
}