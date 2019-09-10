import BigNumber from "bignumber.js";
import {TransactionMdl} from "./TransactionMdl";

export interface BlockMdl {
    _id: BigNumber;

    block_number: BigNumber;

    root_hash: string;

    timestamp: Date;

    transactions: Array<TransactionMdl>;
}