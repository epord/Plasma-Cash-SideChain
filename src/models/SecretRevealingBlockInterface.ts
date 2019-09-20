import BigNumber from "bignumber.js";
import {ITransaction} from "./TransactionInterface";
import {CallBack} from "../utils/TypeDef";

export interface ISRBlock {

    block_number: BigNumber;

    root_hash: string;

    timestamp: Date;

    isSubmitted: boolean,

    save: () => void;
}