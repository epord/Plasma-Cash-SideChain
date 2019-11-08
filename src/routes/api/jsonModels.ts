export interface IJSONBlock {
    blockNumber: string,
    rootHash: string,
    timestamp: string,
    transactions: IJSONTransaction[]
}
export interface IJSONTransaction {

    hash: string
    slot: string
    owner: string
    recipient: string
    blockSpent: string
    minedBlock: string
    minedTimestamp: string
    signature: string
    isSwap: boolean
    swappingSlot: string | undefined
    hashSecret: string | undefined
    secret: string | undefined

}

export interface IJSONSingleSwapData {
    data: IJSONTransaction
    firstInclusionProof?: string
    secretProof?: string
}

export interface IJSONSwapData {

    transaction: IJSONSingleSwapData
    counterpart: IJSONSingleSwapData
    minedBlock: string
    signature: string
    isRevealed: boolean
    proof?: string
    bytes?: string
}

export interface IJSONSRBlock {
    blockNumber: string;
    rootHash: string;
    timestamp: string;
    isSubmitted: boolean,
}

export interface IJSONExitData {
    slot: string,
    prevTxBytes?: string,
    exitingTxBytes: string,
    prevTxInclusionProof?: string,
    exitingTxInclusionProof: string,
    prevTransactionHash?: string,
    lastTransactionHash: string,
    prevBlock?: string,
    exitingBlock: string
    signature?: string,
}

export interface IJSONSingleExitData {
    slot: string,
    bytes: string,
    hash: string,
    proof?: string,
    signature?: string,
    block: string,
}

export interface IJSONChallengeData {
    hash: string,
    slot: string,
    challengingBlockNumber: string,
    challengingTransaction: string,
    proof: string,
    signature: string,
}