import BigNumber from "bignumber.js";
import {CallBack} from "../utils/TypeDef";
import {IBlock} from "./BlockInterface";

export interface ITransaction {
    /**
     * Hash of the transaction
     */
    hash: string;

    slot: BigNumber;

    owner: string;

    recipient: string;

    /**
     * Last block that spend the slot
     * If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
     */
    block_spent: BigNumber;

    /**
     * Block which includes this transaction
     */
    mined_block: BigNumber;
    Mined_Block: IBlock;

    mined_timestamp: Date;
    timestamp: Date;

    signature: string;

    is_swap: boolean;
    swapping_slot: BigNumber;
    hash_secret: string;
    secret: string;

    save: (cb?: CallBack<ITransaction>) => void;
    populate: (field: string, cb: CallBack<ITransaction>) => void;
}

export interface IJSONTransaction {

    hash: string,
    slot: string,
    owner: string,
    recipient: string,
    blockSpent: string,
    minedBlock: string,
    minedTimestamp: string,
    signature: string,
    isSwap: boolean,
    swapping_slot: string | undefined
    hashSecret: string | undefined,
    secret: string | undefined,

}