import {BigNumber} from "bignumber.js";
import {CryptoUtils} from "./CryptoUtils";

// interface ExitData {
//     hash: string,
//     slot: BigNumber,
//     challengingBlockNumber: BigNumber,
//     challengingTransaction: string,
//     proof: string,
//     signature: string
// }

export type CallBack<T> = ((err: any, result?: T) => void)

export type ApiResponse<T> = { statusCode: number, error?: string, result?: T } //TODO remove message

export interface ChallengeData {
    hash: string,
    slot: BigNumber,
    challengingBlockNumber: BigNumber,
    challengingTransaction: string,
    proof: string,
    signature: string,
}