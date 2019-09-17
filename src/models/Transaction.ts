import BigNumber from "bignumber.js";
import {CallBack} from "../utils/TypeDef";
import {Block} from "./Block";

export interface Transaction {
    /**
     * Hash of the transaction
     */
    hash: string;

    slot: BigNumber;

    owner: string;

    recipient: string;

    //TODO: Mejorar comentario
    /**
     * Last block that spend the slot ?
     * If (block_spent % childBlockInterval) == 0 then block_spent is a deposit block
     */
    block_spent: BigNumber;

    //TODO: Ver si podemos hacer referencia a un Block aca?
    /**
     * Block which includes this transaction
     */
    mined_block: BigNumber;
    Mined_Block: Block;

    mined_timestamp: Date;

    signature: string;

    save: () => void;
    populate: (field: string, cb: CallBack<Transaction>) => void;
}