import {CryptoUtils} from "./CryptoUtils";
import {Block} from "../models/Block";
import {Transaction} from "../models/Transaction";
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

    public static groupTransactionsBySlot(arr: Array<Transaction>): Map<string, Array<Transaction>> {
        return arr.reduce((result: Map<string, Array<Transaction>>, e: Transaction) => {
            if (!result.get(e.slot.toFixed())) {
                result.set(e.slot.toFixed(), new Array<Transaction>());
            }
            result.get(e.slot.toFixed())!.push(e);
            return result;
        }, new Map<string, Array<Transaction>>())
    }

    public static blockToJson(block: Block): Object {
        return {
            blockNumber: block.block_number.toFixed(),
            rootHash: block.root_hash,
            timestamp: block.timestamp,
            //TODO check if transactions are populated or not
            transactions: block.transactions
        }
    }

    public static transactionToJson(transaction: Transaction): Object {
        return {
            slot: transaction.slot.toFixed(),
            owner: transaction.owner,
            recipient: transaction.recipient,
            //TODO: This was .hash instead of ._id. See if it still works.
            hash: transaction.hash,
            blockSpent: transaction.block_spent.toFixed(),
            signature: transaction.signature,

            minedTimestamp: transaction.mined_timestamp,
            minedBlock: transaction.mined_block,
        }
    }

//TODO remove slot, get it from lastTx.slot
    public static exitDataToJson(lastTx: Transaction, lastProof: string, prevTx: Transaction, prevProof: string) {
        let prevTxBytes = prevTx ? CryptoUtils.getTransactionBytes(prevTx.slot, prevTx.block_spent, prevTx.recipient) : undefined;
        let prevTxInclusionProof = prevTx ? prevProof : undefined;
        let prevBlock = prevTx ? prevTx.mined_block : undefined;
        let prevTransactionHash = prevTx ? prevTx.hash : undefined;
        return {
            slot: lastTx.slot,
            prevTxBytes,
            exitingTxBytes: CryptoUtils.getTransactionBytes(lastTx.slot, lastTx.block_spent, lastTx.recipient),
            prevTxInclusionProof,
            exitingTxInclusionProof: lastProof,
            signature: lastTx.signature,
            lastTransactionHash: lastTx.hash,
            prevTransactionHash,
            prevBlock: prevBlock,
            exitingBlock: lastTx.mined_block
        }
    }


    public static challengeDataToJson(challengingTx: Transaction, proof: string) {
        return {
            hash: challengingTx.hash,
            slot: challengingTx.slot,
            challengingBlockNumber: challengingTx.mined_block,
            challengingTransaction: CryptoUtils.getTransactionBytes(challengingTx.slot, challengingTx.block_spent, challengingTx.recipient),
            proof: proof,
            signature: challengingTx.signature,
        }
    }

    public static zip<T,U>(arr1: T[], arr2: U[]): ([T, U])[]{
        return arr1.map((value, index) => [value, arr2[index]]);
    }

    public static errorCB(err: any) {
        if(err) console.error(err)
    }
}