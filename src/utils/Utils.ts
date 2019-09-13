import {CryptoUtils} from "./CryptoUtils";
import {BlockMdl} from "../models/BlockMdl";
import {TransactionMdl} from "../models/TransactionMdl";
import BigNumber from "bignumber.js";


export class Utils {

    public static getHighestOccurrence<T>(arr: Array<T>): number {
        let occurrences = new Map<T, number>();
        let max: number = 0;

        arr.forEach(e => {
            if (occurrences.get(e) == undefined) {
                occurrences.set(e, 1);
            } else {
                occurrences.set(e, occurrences.get(e)! + 1);
            }
            if (occurrences.get(e)! > max) {
                max = occurrences.get(e)!
            }
        });

        return max;
    }

    // TODO: Change groupBy only usage for groupTransactionsBySlot when migrating this TS.
    public static groupTransactionsBySlot(arr: Array<TransactionMdl>): Map<BigNumber, Array<TransactionMdl>> {
        return arr.reduce((result: Map<BigNumber, Array<TransactionMdl>>, e: TransactionMdl) => {
            if (result.get(e.slot) == undefined) {
                result.set(e.slot, new Array<TransactionMdl>());
            }
            result.get(e.slot)!.push(e);
            return result;
        }, new Map<BigNumber, Array<TransactionMdl>>())
    }

    // TODO: I think this is never used.
    // public static logErr(err) { if (err) console.log(err) }

    public static blockToJson(block: BlockMdl): Object {
        return {
            blockNumber: block.block_number.toFixed(),
            rootHash: block.root_hash,
            timestamp: block.timestamp,
            //TODO check if transactions are populated or not
            transactions: block.transactions
        }
    }

    public static transactionToJson(transaction: TransactionMdl): Object {
        return {
            slot: transaction.slot.toFixed(),
            owner: transaction.owner,
            recipient: transaction.recipient,
            //TODO: This was .hash instead of ._id. See if it still works.
            hash: transaction._id,
            blockSpent: transaction.block_spent.toFixed(),
            signature: transaction.signature,

            minedTimestamp: transaction.mined_timestamp,
            minedBlock: transaction.mined_block,
        }
    }

//TODO remove slot, get it from lastTx.slot
    public static exitDataToJson(lastTx: TransactionMdl, lastProof: string, prevTx: TransactionMdl, prevProof: string) {
        let prevTxBytes = prevTx ? CryptoUtils.getTransactionBytes(prevTx.slot, prevTx.block_spent, prevTx.recipient) : undefined;
        let prevTxInclusionProof = prevTx ? prevProof : undefined;
        let prevBlock = prevTx ? prevTx.mined_block : undefined;
        let prevTransactionHash = prevTx ? prevTx._id : undefined;
        return {
            slot: lastTx.slot,
            prevTxBytes,
            exitingTxBytes: CryptoUtils.getTransactionBytes(lastTx.slot, lastTx.block_spent, lastTx.recipient),
            prevTxInclusionProof,
            exitingTxInclusionProof: lastProof,
            signature: lastTx.signature,
            lastTransactionHash: lastTx._id,
            prevTransactionHash,
            prevBlock: prevBlock,
            exitingBlock: lastTx.mined_block
        }
    }


    public static challengeDataToJson(challengingTx: TransactionMdl, proof: string) {
        return {
            hash: challengingTx._id,
            slot: challengingTx.slot,
            challengingBlockNumber: challengingTx.mined_block,
            challengingTransaction: CryptoUtils.getTransactionBytes(challengingTx.slot, challengingTx.block_spent, challengingTx.recipient),
            proof: proof,
            signature: challengingTx.signature,
        }
    }

    public static zip(arr1: [], arr2: []) {
        arr1.map((e, i) => [e, arr2[i]])
    }
}