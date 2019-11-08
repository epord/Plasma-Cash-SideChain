import {CryptoUtils} from "./CryptoUtils";
import {ApiResponse} from "./TypeDef";
import Status from 'http-status-codes';
import * as EthUtils from 'ethereumjs-util';
import {
    IJSONBlock,
    IJSONChallengeData,
    IJSONExitData,
    IJSONSingleSwapData,
    IJSONSRBlock,
    IJSONSwapData,
    IJSONTransaction
} from "../routes/api/jsonModels";
import {ISingleSwapData, ITransaction} from "../models/transaction";
import {IBlock} from "../models/block";
import {ISRBlock} from "../models/secretRevealingBlock";
import * as e from "express";
import RLP = require('rlp');

const debug = require('debug')('app:api:Utils');

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
            slot: transaction.slot.toString(),
            isSwap: transaction.is_swap,
            owner: transaction.owner,
            recipient: transaction.recipient,
            hash: transaction.hash,
            blockSpent: transaction.block_spent.toString(),
            signature: transaction.signature,

            minedTimestamp: transaction.mined_timestamp,
            minedBlock: transaction.mined_block,
        };

        if(transaction.is_swap) {
            transactionObj.swappingSlot = transaction.swapping_slot.toString();
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
                new EthUtils.BN(swapDataA.data.slot.toFixed()).toBuffer(),
                new EthUtils.BN(swapDataA.data.block_spent.toFixed()).toBuffer(),
                EthUtils.toBuffer(swapDataA.data.secret!),
                EthUtils.toBuffer(swapDataA.data.recipient),

                new EthUtils.BN(swapDataB.data.slot.toFixed()).toBuffer(),
                new EthUtils.BN(swapDataB.data.block_spent.toFixed()).toBuffer(),
                EthUtils.toBuffer(swapDataB.data.secret!),
                EthUtils.toBuffer(swapDataB.data.recipient),
                EthUtils.toBuffer(swapDataB.data.signature)
            ];
            bytes = EthUtils.bufferToHex(RLP.encode(bytesParams));
        }


        return {
            transaction: this.singleSwapDataToJson(swapDataA),
            counterpart: this.singleSwapDataToJson(swapDataB),
            proof,
            minedBlock: swapDataA.data.mined_block.toFixed(),
            signature: swapDataA.data.signature!,
            bytes,
            isRevealed: (swapDataA.data.secret != undefined && swapDataB.data.secret != undefined)
        }


    }

    public static async exitDataToJson(lastTx: ITransaction, lastProof: string, prevTx?: ITransaction, prevProof?: string): Promise<IJSONExitData> {
        let prevTxBytes = prevTx ? await CryptoUtils.getTransactionBytes(prevTx) : undefined;
        let prevTxInclusionProof = prevTx ? prevProof : undefined;
        let prevBlock = prevTx ? prevTx.mined_block : undefined;
        let prevTransactionHash = prevTx ? prevTx.hash : undefined;
        return {
            slot: lastTx.slot.toString(),
            prevTxBytes,
            exitingTxBytes: await CryptoUtils.getTransactionBytes(lastTx),
            prevTxInclusionProof,
            exitingTxInclusionProof: lastProof,
            signature: lastTx.signature!,
            lastTransactionHash: lastTx.hash,
            prevTransactionHash,
            prevBlock: prevBlock ? prevBlock.toString() : undefined,
            exitingBlock: lastTx.mined_block.toString()
        }
    }


    public static async challengeDataToJson(challengingTx: ITransaction, proof: string): Promise<IJSONChallengeData> {
        return {
            hash: challengingTx.hash,
            slot: challengingTx.slot.toString(),
            challengingBlockNumber: challengingTx.mined_block.toString(),
            challengingTransaction: await CryptoUtils.getTransactionBytes(challengingTx),
            proof: proof,
            signature: challengingTx.signature!,
        }
    }

    public static zip<T,U>(arr1: T[], arr2: U[]): ([T, U])[]{
        return arr1.map((value, index) => [value, arr2[index]]);
    }

    public static errorCB(err: any) {
        if(err) console.error(err)
    }

    public static logError(err: any | ApiResponse<any>) {
        if (err && !err.statusCode) {
            return debug(`ERROR: ${(err.error || err.message)}`)
        } else if (err && err.statusCode && err.error) {
            return debug(`ERROR: Code: ${err.statusCode} error:${err.error}`)
        }
    };

    public static responseWithStatus<T>(res: e.Response, mapper?: (_: T) => string | Object) {
        return (err: any, status?: ApiResponse<T>) => {
            Utils.logError(err);
            Utils.logError(status);

            if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
            if (err && err.statusCode) return res.status(err.statusCode).json(err.error);
            if (status === undefined) return res.status(Status.INTERNAL_SERVER_ERROR).json("No status");
            if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
            if (status.error) return res.status(status.statusCode).json(status.error);
            if(mapper) {
                return res.status(status.statusCode).json(mapper(status.result!))
            } else {
                return res.status(status.statusCode).json(status.result)
            }
        };
    }

    public static randomHex256 = () => {
        const dict = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'a', 'b', 'c', 'd', 'e', 'f'];
        let hex = '0x';
        for (let i = 0; i < 64; i++) {
            const i = Math.floor(Math.random() * dict.length);
            hex += dict[i];
        }
        return hex;
    }

}