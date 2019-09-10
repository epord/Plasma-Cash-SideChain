import BigNumber from "bignumber.js";

export interface TransactionMdl {
    /**
     * Hash of the transaction
     */
    _id: string;

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

    mined_timestamp: Date;

    signature: string;
}