import BN = require("bn.js");
import EthUtils = require("ethereumjs-util");
import RLP = require('rlp');
import async = require('async');
import CryptoMonsJson = require("../json/CryptoMons.json");
import RootChainJson = require("../json/RootChain.json");
import VMCJson = require("../json/ValidatorManagerContract.json");
import CMBJson = require("../json/CryptoMonBattles.json");
import PlasmaCMJson = require("../json/PlasmaCM.json");
import  abi = require('ethereumjs-abi');
import BigNumber from "bignumber.js";
import {SparseMerkleTree} from "./SparseMerkleTree";
import Web3 from "web3";
import {CallBack} from "./TypeDef";
import {AbiItem} from "web3-utils";
import {TransactionService} from "../services";
import {toCMBBytes} from "./CryptoMonBattles";
import {IBlock} from "../models/block";
import {ITransaction} from "../models/transaction";
import {ISRBlock} from "../models/secretRevealingBlock";
import {IChannelState, ICryptoMon, IPokemonData} from "../models/battle";

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
            EthUtils.setLengthLeft(new BN(transaction.slot.toFixed()).toBuffer(), 256/8),   // uint256 little endian
            EthUtils.setLengthLeft(new BN(transaction.block_spent.toFixed()).toBuffer(), 256/8),    // uint256 little endian
            EthUtils.toBuffer(transaction.secret || "0x0"), // must start with 0x
            EthUtils.toBuffer(transaction.recipient),
            // @ts-ignore TODO: Remove ts-ignore when this is fixed
            EthUtils.setLengthLeft(new BN(counterpart.slot.toFixed()).toBuffer(), 256/8),   // uint256 little endian
            // @ts-ignore TODO: Remove ts-ignore when this is fixed
            EthUtils.setLengthLeft(new BN(counterpart.block_spent.toFixed()).toBuffer(), 256/8),    // uint256 little endian
            // @ts-ignore TODO: Remove ts-ignore when this is fixed
            EthUtils.toBuffer(counterpart.secret || "0x0"), // must start with 0x
            // @ts-ignore TODO: Remove ts-ignore when this is fixed
            EthUtils.toBuffer(counterpart.recipient),   // must start with 0x
            // @ts-ignore TODO: Remove ts-ignore when this is fixed
            EthUtils.toBuffer(counterpart.signature),   // must start with 0x
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


    public static validateCryptoMons(done: CallBack<void>) {
        web3.eth.getAccounts().then((accounts: string[]) => {
            async.parallel([
                (cb: any) => {
                    const VMC = new web3.eth.Contract(VMCJson.abi as AbiItem[], VMCJson.networks["5777"].address);
                    VMC.methods.setToken(CryptoMonsJson.networks["5777"].address, true).send({from: accounts[0]},
                        (err: Error, res: Response) => {
                            if (err) {
                                debug("ERROR: Contract couldn't be validated")
                                debug(err);
                                return cb(err);
                            }
                            debug("Validated CryptoMon deposit");
                            cb(null);
                    });
                },
                (cb: any) => {
                    const CryptoMonBattles = new web3.eth.Contract(CMBJson.abi as AbiItem[], CMBJson.networks["5777"].address);
                    CryptoMonBattles.methods.setValidator(PlasmaCMJson.networks["5777"].address, true).send({from: accounts[0]},
                        (err: Error, res: Response) => {
                            if (err) {
                                debug("ERROR: Contract couldn't be validated")
                                debug(err);
                                return cb(err);
                            }
                            debug("Validated CryptoMon battles");
                            cb(null);
                    });
                }
            ], (err: any) => done(err));
        });
    }

    public static getPlasmaCoinId(slot: string, done: CallBack<string>) {
        web3.eth.getAccounts().then((accounts: string[]) => {
            const RootChainContract = new web3.eth.Contract(RootChainJson.abi as AbiItem[], RootChainJson.networks["5777"].address);
            RootChainContract.methods.getPlasmaCoin(slot).call({from: accounts[0]},(err: Error, res: any) => {
                if (err) {
                    debug("ERROR: Couldn't fetch plasma coin id");
                    debug(err);
                    return done(err);
                }
                const id = new BigNumber(res[0]).toFixed();
                done(null, id);
            });
        });
    }

    public static getCryptomon(slot: string, done: CallBack<ICryptoMon>) {
        web3.eth.getAccounts().then((accounts: string[]) => {
            const CryptoMonsContract = new web3.eth.Contract(CryptoMonsJson.abi as AbiItem[], CryptoMonsJson.networks["5777"].address);
            CryptoMonsContract.methods.getCryptomon(slot).call({from: accounts[0]}, (err: Error, res: any) => {
                if (err) {
                    debug("ERROR: Couldn't fetch CryptoMon instance");
                    debug(err);
                    return done(err);
                }
                let cryptoMon: ICryptoMon = {
                    id: res.id,
                    gender: res.gender,
                    isShiny: res.isShiny,
                    IVs: {
                        hp: res.IVs.hp,
                        atk: res.IVs.atk,
                        def: res.IVs.def,
                        spAtk: res.IVs.spAtk,
                        spDef: res.IVs.spDef,
                        speed: res.IVs.speed
                    },
                    stats: {
                        hp: res.stats.hp,
                        atk: res.stats.atk,
                        def: res.stats.def,
                        spAtk: res.stats.spAtk,
                        spDef: res.stats.spDef,
                        speed: res.stats.speed
                    },
                };
                done(null, cryptoMon)
            });
        });
    }

    public static getPokemonData(id: string, done: CallBack<IPokemonData>) {
        web3.eth.getAccounts().then((accounts: string[]) => {
            const CryptoMonsContract = new web3.eth.Contract(CryptoMonsJson.abi as unknown as AbiItem[], CryptoMonsJson.networks["5777"].address);
            CryptoMonsContract.methods.getPokemonData(id).call({from: accounts[0]}, (err: Error, res: any) => {
                if (err) {
                    debug("ERROR: Couldn't fetch pokemon data");
                    debug(err);
                    return done(err);
                }
                const pokeData: IPokemonData = {
                    id: res.id,
                    type1: res.type1,
                    type2: res.type2,
                    base: {
                        hp: res.base.hp,
                        atk: res.base.atk,
                        def: res.base.def,
                        spAtk: res.base.spAtk,
                        spDef: res.base.spDef,
                        speed: res.base.speed

                    }
                };

                done(null, pokeData);
            });
        });
    }

    public static hashChannelState(state: IChannelState) {

        return EthUtils.bufferToHex(
            abi.soliditySHA3(["uint256","address","address[]","uint256","bytes"],
                [
                    state.channelId,
                    state.channelType,
                    state.participants,
                    state.turnNum,
                    toCMBBytes(state.game)
                ])
            )
    }
}