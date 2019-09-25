import BigNumber from "bignumber.js";
import {ITransaction} from "./TransactionInterface";
import {CallBack} from "../utils/TypeDef";

export interface ISRBlock {

    block_number: BigNumber;

    root_hash: string;

    timestamp: Date;

    is_submitted: boolean,

    save: (cb?: CallBack<ISRBlock>) => void;
}

export interface IJSONSRBlock {

    blockNumber: string;

    rootHash: string;

    timestamp: string;

    isSubmitted: boolean,
}
