import BigNumber from "bignumber.js";
import {ITransaction} from "./TransactionInterface";
import {CallBack} from "../utils/TypeDef";

export interface IBlock {

    block_number: BigNumber;

    root_hash: string;

    timestamp: Date;

    transactions: Array<string>;
    Transactions: Array<ITransaction>;

    save: () => void;
    populate: (field: string, cb: CallBack<IBlock>) => void;
}