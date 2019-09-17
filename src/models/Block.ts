import BigNumber from "bignumber.js";
import {Transaction} from "./Transaction";
import {CallBack} from "../utils/TypeDef";

export interface Block {

    block_number: BigNumber;

    root_hash: string;

    timestamp: Date;

    transactions: Array<string>;
    Transactions: Array<Transaction>;

    save: () => void;
    populate: (field: string, cb: CallBack<Block>) => void;
}