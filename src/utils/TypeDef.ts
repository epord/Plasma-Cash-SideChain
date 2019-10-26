import {BigNumber} from "bignumber.js";

// interface ExitData {
//     hash: string,
//     slot: BigNumber,
//     challengingBlockNumber: BigNumber,
//     challengingTransaction: string,
//     proof: string,
//     signature: string
// }
export type Maybe<T> = { err?: any, result?: T }

export type CallBack<T> = ((err: any, result?: T) => void)

export type ApiResponse<T> = { statusCode: number, error?: string, result?: T }

export interface ChallengeData {
    hash: string,
    slot: BigNumber,
    challengingBlockNumber: BigNumber,
    challengingTransaction: string,
    proof: string,
    signature: string,
}