import {CryptoUtils} from "./CryptoUtils";
import {IBlock, IJSONBlock} from "../models/BlockInterface";
import {
    IJSONSingleSwapData,
    IJSONSwapData,
    IJSONTransaction,
    ISingleSwapData,
    ITransaction
} from "../models/TransactionInterface";
import {ApiResponse} from "./TypeDef";
import Status from 'http-status-codes';
import {IJSONSRBlock, ISRBlock} from "../models/SecretRevealingBlockInterface";
import RLP from 'rlp';
import * as EthUtils from 'ethereumjs-util';

const debug = require('debug')('app:api:Utils')

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

    public static groupTransactionsBySlot(arr: Array<ITransaction>): Map<string, ITransaction[]> {
        return arr.reduce((result: Map<string, Array<ITransaction>>, e: ITransaction) => {
            if (!result.get(e.slot.toFixed())) {
                result.set(e.slot.toFixed(), new Array<ITransaction>());
            }
            result.get(e.slot.toFixed())!.push(e);
            return result;
        }, new Map<string, ITransaction[]>())
    }

    public static blockToJson(block: IBlock): IJSONBlock {
        return {
            blockNumber: block.block_number.toFixed(),
            rootHash: block.root_hash,
            timestamp: block.timestamp.toString(),
            transactions: block.Transactions.map(Utils.transactionToJson)
        }
    }

    public static secretBlockToJson(block: ISRBlock): IJSONSRBlock {
        return {
            blockNumber: block.block_number.toFixed(),
            rootHash: block.root_hash,
            timestamp: block.timestamp.toString(),
            isSubmitted: block.is_submitted,

        }
    }

    public static groupOnlySwappingPairs = (transactions: ITransaction[]): Map<string, ITransaction> => {
        let map = new Map<string, ITransaction>();
        const groupedArrays = Utils.groupTransactionsBySlot(transactions);

        for (let slot of groupedArrays.keys()) {
            if(map.has(slot)) continue;

            for(let t of groupedArrays.get(slot)!) {
                let swappingSlot = t.swapping_slot.toFixed();

                if(groupedArrays.has(swappingSlot)) {
                    let swappingCandidates = groupedArrays.get(swappingSlot)!;
                    let index = swappingCandidates.map(t=>t.swapping_slot.toFixed()).indexOf(slot);
                    if(index>=0) {
                        map.set(slot, t);
                        map.set(swappingSlot, swappingCandidates[index]);
                        break;
                    }
                }
            }
        }

        return map;
    };


    public static transactionToJson(transaction: ITransaction): IJSONTransaction {

        let transactionObj: any = {
            slot: transaction.slot.toFixed(),
            owner: transaction.owner,
            recipient: transaction.recipient,
            hash: transaction.hash,
            blockSpent: transaction.block_spent.toFixed(),
            signature: transaction.signature,

            minedTimestamp: transaction.mined_timestamp,
            minedBlock: transaction.mined_block,
        }

        if(transaction.is_swap) {
            transactionObj.swappingSlong = transaction.swapping_slot.toFixed();
            transactionObj.hashSecret = transaction.hash_secret;
            transactionObj.secret = transaction.secret;
        }

        return transactionObj;
    }

    public static singleSwapDataToJson(swapData: ISingleSwapData): IJSONSingleSwapData {
        return {
            data: this.transactionToJson(swapData.data),
            firstInclusionProof: swapData.firstInclusionProof,
            secretProof:        swapData.secretProof
        }
    }

    public static swapDataToJson(swapDataA: ISingleSwapData, swapDataB: ISingleSwapData): IJSONSwapData {
        let bytes = undefined;
        let proof = undefined;

        if(swapDataA.data.secret && swapDataB.data.secret) {
            const proofParams = [
                swapDataA.firstInclusionProof!,
                swapDataB.firstInclusionProof!,
                swapDataA.secretProof!,
                swapDataB.secretProof!
            ];

            proof = EthUtils.bufferToHex(RLP.encode(proofParams));

            const bytesParams = [
                new EthUtils.BN(swapDataA.data.slot.toFixed()),
                new EthUtils.BN(swapDataA.data.block_spent.toFixed()),
                swapDataA.data.secret!,
                swapDataA.data.recipient,

                new EthUtils.BN(swapDataB.data.slot.toFixed()),
                new EthUtils.BN(swapDataB.data.block_spent.toFixed()),
                swapDataB.data.secret!,
                swapDataB.data.recipient,

                swapDataB.data.signature
            ];
            bytes = EthUtils.bufferToHex(RLP.encode(bytesParams));
        }


        return {
            transaction: this.singleSwapDataToJson(swapDataA),
            counterpart: this.singleSwapDataToJson(swapDataB),
            proof,
            mined_block: swapDataA.data.mined_block.toFixed(),
            signature:   swapDataA.data.signature,
            bytes,
            isRevealed: (swapDataA.data.secret != undefined && swapDataB.data.secret != undefined)
        }


    }

    public static exitDataToJson(lastTx: ITransaction, lastProof: string, prevTx: ITransaction, prevProof: string) {
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


    public static challengeDataToJson(challengingTx: ITransaction, proof: string) {
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

    public static logError(err: any | ApiResponse<any>) {
        if (err && !err.statusCode)
            return debug("ERROR: " + err);
        if (err && err.statusCode && err.error)
            return debug("ERROR: " + err.error);
    };

    public static responseWithStatus<T>(res: any, mapper?: (_: T) => string | Object) {
        return (err: any, status: ApiResponse<T>)  => {
            Utils.logError(err);
            if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
            if (err && err.statusCode) return res.status(err.statusCode).json(err.error);
            if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
            if(mapper) {
                return res.status(status.statusCode).json(mapper(status.result!))
            } else {
                return res.status(status.statusCode).json(status.result)
            }
        };
    }

    public static responseWithStatusIfError<T>(res: any, err: any, status: ApiResponse<T>): T | undefined {
        Utils.logError(err);
        if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
        if (err && err.statusCode) return res.status(err.statusCode).json(err.error);
        if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");

        return status.result;
    }
}