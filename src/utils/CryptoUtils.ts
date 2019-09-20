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

const debug = require('debug')('app:CryptoUtils');
const web3: Web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL!));

export class CryptoUtils {

    public static generateTransactionHash(slot: BigNumber, blockSpent: BigNumber, recipient: string): string {
        if(blockSpent.isZero()) {
            return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8))) //uint64 little endian
        } else {
            return EthUtils.bufferToHex(EthUtils.keccak256(this.getTransactionBytes(slot, blockSpent, recipient)))
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
            let params = [
                //TODO check if this can be less than 256 (using other than toUint() in solidity. Maybe to Address())?
                EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 256/8), 		 // uint256 little endian
                EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	 // uint256 little endian
                EthUtils.toBuffer(hashSecret),													 // must start with 0x
                EthUtils.toBuffer(recipient),												     // must start with 0x
                EthUtils.setLengthLeft(new BN(swappingSlot.toFixed()).toBuffer(), 256/8), // uint256 little endian
            ];

            const bytes = EthUtils.bufferToHex(RLP.encode(params));
            return EthUtils.bufferToHex(EthUtils.keccak256(bytes))
        }
    }

    public static validateHash = (message: string, hash: string) => {
        return  EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.toBuffer(message))).toLowerCase() == hash.toLowerCase();
    };

    public static getTransactionBytes(slot: BigNumber, blockSpent: BigNumber, recipient: string): string  {
        let params = [
            //TODO check if this can be less than 256 (using other than toUint() in solidity. Maybe to Address())?
            EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 256/8), 			// uint256 little endian
            EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
            EthUtils.toBuffer(recipient),																						// must start with 0x
        ];

        return EthUtils.bufferToHex(RLP.encode(params));
    }

    public static generateDepositBlockRootHash(slot: BigNumber): string {
        return this.keccak256(
            EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8), 		// uint64 little endian
        )
    }

    private static keccak256(...args: Uint8Array[]): string {
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
        const hash = this.generateAtomicSwapTransactionHash(slotBN, blockSpentBN, hashSecret, recipient, swappingSlotBN);
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
            leaves.set(value.slot.toFixed(), this.generateTransactionHash(value.slot, value.block_spent, value.recipient));
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


    public static validateCryptoMons(cb: CallBack<void>) {
        const VMC = new web3.eth.Contract(VMCJson.abi as AbiItem[], VMCJson.networks["5777"].address);
        web3.eth.getAccounts().then((accounts: string[]) => {
            VMC.methods.setToken(CryptoMonsJson.networks["5777"].address, true).send({from: accounts[0]},
                (err: Error, res: Response) => {
                    if (err) return cb(err);
                    debug("Validated contract");
                    cb(null);
            });
        });
    }
}