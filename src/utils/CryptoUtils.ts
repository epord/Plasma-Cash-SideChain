import BN = require("bn.js");
import BigNumber from "bignumber.js";
import {TransactionMdl} from "../models/TransactionMdl";
import {BlockMdl} from "../models/BlockMdl";
import {SparseMerkleTree} from "./SparseMerkleTree";
import EthUtils = require("ethereumjs-util");
import RLP = require('rlp');
import CryptoMonsJson = require("../json/CryptoMons.json");
import RootChainJson = require("../json/RootChain.json");
import VMCJson = require("../json/ValidatorManagerContract.json");
import Web3 from "web3";

const web3: Web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL!));

export class CryptoUtils {

    public static generateTransactionHash(slot: BigNumber, blockSpent: BigNumber, recipient: string): string {
        if(blockSpent.isZero()) {
            return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8))) //uint64 little endian
        } else {
            return EthUtils.bufferToHex(EthUtils.keccak256(this.getTransactionBytes(slot, blockSpent, recipient)))
        }
    }

    public static getTransactionBytes(slot: BigNumber, blockSpent: BigNumber, recipient: string): string  {
        let params = [
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

    private static keccak256(args: number[]): string {
        let params: Uint8Array[] = [];
        args.forEach((arg) => {
            params.push(new Uint8Array(arg));
        });

        return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.bufferToHex(Buffer.concat(params))));
    }

    public static pubToAddress(publicKey: string) {
        return EthUtils.bufferToHex(EthUtils.pubToAddress(EthUtils.toBuffer(publicKey)));
    }

    // Only used for testing.
    public static generateTransaction(slot: BigNumber, owner: BigNumber, recipient: string, blockSpent: BigNumber, privateKey: string) {
        //TODO migrate slot and blockSpent to BigNumber
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


    public static generateSMTFromTransactions(transactions: Array<TransactionMdl>) {
        let leaves = new Map<string, string>();
        transactions.forEach(value => {
            //TODO: Ver aca porque dice que en realidad un BigNumber no puede usarse como índice. Qué pasaba con JS? Por qué funcionaba?
            // Casi seguro que hace un toString
            leaves.set(value.slot.toString(), this.generateTransactionHash(value.slot, value.block_spent, value.recipient));
        });

        return new SparseMerkleTree(64, leaves);
    }


    public static submitBlock(block: BlockMdl, cb: Function) {
        // TODO: Ver si con el ts ignore funciona
        // @ts-ignore
        const RootChainContract = new web3.eth.Contract(RootChainJson.abi, RootChainJson.networks["5777"].address);
        web3.eth.getAccounts().then((accounts: string[]) => {
            if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
            RootChainContract.methods.submitBlock(block._id.toFixed(), block.root_hash).send({from: accounts[0]}, (err: Error, res: Response) => {
                if (err) return cb(err);
                cb();
            });
        });
    }


    public static validateCryptoMons(cb: Function) {
        // TODO: Ver si con el ts ignore funciona
        // @ts-ignore
        const VMC = new web3.eth.Contract(VMCJson.abi, VMCJson.networks["5777"].address);
        web3.eth.getAccounts().then((accounts: string[]) => {
            // TODO: Ver el tema de cb(err) que cambié por cb()
            if (!accounts || accounts.length == 0) return cb();
            VMC.methods.setToken(CryptoMonsJson.networks["5777"].address, true).send({from: accounts[0]}, (err: Error, res: Response) => {
                if (err) return cb(err);
                console.log("Validated contract");
                cb();
            });
        });
    }
}