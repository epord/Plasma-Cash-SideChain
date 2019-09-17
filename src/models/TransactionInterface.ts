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
    Mined_Block: IBlock;

    mined_timestamp: Date;

    signature: string;

    save: () => void;
    populate: (field: string, cb: CallBack<ITransaction>) => void;
}