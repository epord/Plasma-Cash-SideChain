import BN = require("bn.js");
import BigNumber from "bignumber.js";
import {ITransaction} from "../models/TransactionInterface";
import {IBlock} from "../models/BlockInterface";
import {SparseMerkleTree} from "./SparseMerkleTree";
import EthUtils = require("ethereumjs-util");
import RLP = require('rlp');
import CryptoMonsJson = require("../json/CryptoMons.json");
import RootChainJson = require("../json/RootChain.json");
import VMCJson = require("../json/ValidatorManagerContract.json");
import Web3 from "web3";
import {CallBack} from "./TypeDef";
import {AbiItem} from "web3-utils";
import {ISRBlock} from "../models/SecretRevealingBlockInterface";
import {TransactionService} from "../services";
import {IState} from "../models/BattleInterface";
import  abi = require('ethereumjs-abi');
import {toBytes} from "./RPSExample";

const debug = require('debug')('app:CryptoUtils');
const web3: Web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL!));

export class CryptoUtils {

    public static generateTransactionHash(slot: BigNumber, blockSpent: BigNumber, recipient: string): string {
        if(blockSpent.isZero()) {
            return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8))) //uint64 little endian
        } else {
            return EthUtils.bufferToHex(EthUtils.keccak256(this.getBasicTransactionBytes(slot, blockSpent, recipient)))
        }
    }

    public static generateAtomicSwapTransactionHash(
        slot: BigNumber,
        blockSpent: BigNumber,
        hashSecret: string,
        recipient: string,
        swappingSlot: BigNumber): string | undefined {
        if(blockSpent.isZero()) {
            debug("ERROR: Deposits can never be an atomic swap");
            return undefined;
        } else {
            return this.keccak256(
                EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8), 		 // uint256 little endian
                EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	 // uint256 little endian
                EthUtils.toBuffer(hashSecret),													 // must start with 0x
                EthUtils.toBuffer(recipient),												     // must start with 0x
                EthUtils.setLengthLeft(new BN(swappingSlot.toFixed()).toBuffer(), 64/8), // uint256 little endian
            );
        }
    }

    public static validateHash = (message: string, hash: string) => {
        return  EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.toBuffer(message))).toLowerCase() == hash.toLowerCase();
    };

    public static async getTransactionBytes(transaction: ITransaction): Promise<string> {
        if(transaction.is_swap) {
            return await this.getAtomicSwapTransactionBytes(transaction);
        } else {
            return this.getBasicTransactionBytes(transaction.slot, transaction.block_spent, transaction.recipient);
        }
    }
    public static getBasicTransactionBytes(slot: BigNumber, blockSpent: BigNumber, recipient: string): string  {
        let params = [
            //TODO check if this can be less than 256 (using other than toUint() in solidity. Maybe to Address())?
            EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 256/8), 			// uint256 little endian
            EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
            EthUtils.toBuffer(recipient),																						// must start with 0x
        ];

        return EthUtils.bufferToHex(RLP.encode(params));
    }

    public static async getAtomicSwapTransactionBytes(transaction: ITransaction): Promise<string>  {
        let counterpart = await TransactionService.findOne({slot: transaction.swapping_slot, mined_block: transaction.mined_block}).exec();

        let params = [
            //TODO check if this can be less than 256 (using other than toUint() in solidity. Maybe to Address())?
            EthUtils.setLengthLeft(new BN(transaction.slot.toFixed()).toBuffer(), 256/8), 			// uint256 little endian
            EthUtils.setLengthLeft(new BN(transaction.block_spent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
            EthUtils.toBuffer(transaction.secret || "0x0"),																						// must start with 0x
            EthUtils.toBuffer(transaction.recipient),
            EthUtils.setLengthLeft(new BN(counterpart.slot.toFixed()).toBuffer(), 256/8), 			// uint256 little endian
            EthUtils.setLengthLeft(new BN(counterpart.block_spent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
            EthUtils.toBuffer(counterpart.secret || "0x0"),																						// must start with 0x
            EthUtils.toBuffer(counterpart.recipient),// must start with 0x
            EthUtils.toBuffer(counterpart.signature),// must start with 0x
        ];

        return EthUtils.bufferToHex(RLP.encode(params));
    }

    public static generateDepositBlockRootHash(slot: BigNumber): string {
        return this.keccak256(
            EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8), 		// uint64 little endian
        )
    }

    public static keccak256(...args: Uint8Array[]): string {
        return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.bufferToHex(Buffer.concat(args))));
    }

    public static pubToAddress(publicKey: string) {
        return EthUtils.bufferToHex(EthUtils.pubToAddress(EthUtils.toBuffer(publicKey)));
    }

    // Only used for testing.
    public static generateTransaction(slot: string, owner: string, recipient: string, blockSpent: string, privateKey: string) {
        const slotBN = new BigNumber(slot);
        const blockSpentBN = new BigNumber(blockSpent);
        const hash = this.generateTransactionHash(slotBN, blockSpentBN, recipient);
        const signature = EthUtils.ecsign(EthUtils.toBuffer(hash), EthUtils.toBuffer(privateKey));

        // This method simulates eth-sign RPC method
        // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
        const realSignature = EthUtils.toRpcSig(signature.v, signature.r, signature.s);

        return {
            slot: slotBN.toFixed(),
            owner: owner,
            recipient: recipient,
            hash: hash,
            blockSpent: blockSpentBN.toFixed(),
            signature: realSignature
        };
    }

    // Only used for testing.
    public static generateAtomicSwapTransaction(
        slot: string,
        owner: string,
        recipient: string,
        blockSpent: string,
        swappingSlot: string,
        hashSecret: string,
        privateKey: string) {

        const slotBN = new BigNumber(slot);
        const blockSpentBN = new BigNumber(blockSpent);
        const swappingSlotBN = new BigNumber(swappingSlot);
        const hash = this.generateAtomicSwapTransactionHash(slotBN, blockSpentBN, hashSecret, recipient, swappingSlotBN)!;
        const signature = EthUtils.ecsign(EthUtils.toBuffer(hash), EthUtils.toBuffer(privateKey));

        // This method simulates eth-sign RPC method
        // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
        const realSignature = EthUtils.toRpcSig(signature.v, signature.r, signature.s);

        return {
            slot,
            blockSpent,
            owner,
            recipient,
            swappingSlot,
            hashSecret: hashSecret,
            hash,
            signature: realSignature,
        };
    }



    public static generateSMTFromTransactions(transactions: ITransaction[]) {
        let leaves = new Map<string, string>();
        transactions.forEach(value => {
            leaves.set(value.slot.toFixed(), value.hash);
        });

        return new SparseMerkleTree(64, leaves);
    }

    public static generateSecretRevealingSMTFromTransactions(transactions: ITransaction[]) {
        let leaves = new Map<string, string>();
        transactions.forEach(value => {
            if(!value.secret) {
                console.error("Trying to create a Merkle Tree and secret is missing");
            }

            leaves.set(value.slot.toFixed(), value.secret!);
        });

        return new SparseMerkleTree(64, leaves);
    }


    public static submitBlock(block: IBlock, cb: CallBack<void>) {
        if(process.env.BLOCKCHAINLESS) return cb(null);
        const RootChainContract = new web3.eth.Contract(RootChainJson.abi as AbiItem[], RootChainJson.networks["5777"].address);
        web3.eth.getAccounts().then((accounts: string[]) => {
            if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
            RootChainContract.methods.submitBlock(block.block_number.toFixed(), block.root_hash).send({from: accounts[0]},
                (err: Error, res: Response) => {
                    if (err) return cb(err);
                    debug("Block submitted");
                    cb(null);
            });
        });
    }

    public static submitSecretBlock(block: ISRBlock, cb: CallBack<void>) {
        if(process.env.BLOCKCHAINLESS) return cb(null);
        const RootChainContract = new web3.eth.Contract(RootChainJson.abi as AbiItem[], RootChainJson.networks["5777"].address);
        web3.eth.getAccounts().then((accounts: string[]) => {
            if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
            RootChainContract.methods.submitSecretBlock(block.block_number.toFixed(), block.root_hash).send({from: accounts[0]},
                (err: Error, res: Response) => {
                    if (err) return cb(err);
                    debug("Block Secret submitted");
                    cb(null);
                });
        });
    }


    public static validateCryptoMons(cb: CallBack<void>) {
        const VMC = new web3.eth.Contract(VMCJson.abi as AbiItem[], VMCJson.networks["5777"].address);
        web3.eth.getAccounts().then((accounts: string[]) => {
            VMC.methods.setToken(CryptoMonsJson.networks["5777"].address, true).send({from: accounts[0]},
                (err: Error, res: Response) => {
                    if (err) {
                        debug("ERROR: Contract couldn't be validated")
                        debug(err);
                        return cb(err);
                    }
                    debug("Validated contract");
                    cb(null);
            });
        });
    }

    public static hashChannelState(state: IState) {

        return EthUtils.keccak256(abi.rawEncode(["uint256","address","address[]","uint256","bytes"],
            [
                state.channelId,
                state.channelType,
                state.participants,
                state.turnNum,
                toBytes(state.game)
            ])
        );

    }
}