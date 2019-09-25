import {CryptoUtils} from "../src/utils/CryptoUtils";
import { BlockService, TransactionService, CoinStateService, SecretRevealingBlockService } from '../src/services';
import {CallBack} from "../src/utils/TypeDef";
import {BigNumber} from "bignumber.js";
import * as EthUtils from "ethereumjs-util"

const async = require('async');

export class TestUtils {

    public static _owner        = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    public static _recipient    = '0x6C7B0A12E80f1C7Aae55E0DEeEE4C4e378C2Cb4A';
    public static _privateKey   = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    public static _recipientPK  = '0xaa6d0a9653d94b802195bfd7002f5273021cf709c1e785b332f8173a8b91c487';
    public static _slot         = "1";
    public static _slotB        = "2";
    public static _blockNumber  = "2";
    public static _blockNumberB  = "3";
    public static _secretA       = "0x25";
    public static _hashSecretA   = EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.toBuffer(TestUtils._secretA)));
    public static _secretB       = "0x50";
    public static _hashSecretB   = EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.toBuffer(TestUtils._secretB)));

    public static transactionURL    = "/api/transactions/create";
    public static atomicSwapURL    = "/api/transactions/createAtomicSwap";
    public static revealSecretURL   = "/api/transactions/revealSecret";
    public static depositURL        = "/api/blocks/deposit";
    public static blocksURL = "/api/blocks/";
    public static mineURL = "/api/blocks/mine";
    public static secretBlockURL = (slot: string) => TestUtils.blocksURL + "secretBlock/" + slot;


    public static Alice = TestUtils._owner;
    public static AlicePK =  TestUtils._privateKey;
    public static Bob = TestUtils._recipient;
    public static BobPK = TestUtils._recipientPK;
    public static Carl = '0xb9aCBd4964aBfb68c0Bb2298a92eca751e5db8Ea';
    public static CarlPK = '0x2ef40bc7684ea255106dbb70b272da62e7bf939b61ceb097fe37160dbd05a67e';


    public static lastSlotOwnerURL = (slot: string) => `/api/tokens/${slot}/last-owner`;

    public static _transaction = CryptoUtils.generateTransaction(
        TestUtils._slot,
        TestUtils._owner,
        TestUtils._recipient,
        TestUtils._blockNumber,
        TestUtils._privateKey);


    public static _atomicSwapTransactionA = CryptoUtils.generateAtomicSwapTransaction(
        TestUtils._slot,
        TestUtils._owner,
        TestUtils._recipient,
        TestUtils._blockNumber,
        TestUtils._slotB,
        TestUtils._hashSecretA,
        TestUtils._privateKey,
    );

    public static _atomicSwapTransactionB = CryptoUtils.generateAtomicSwapTransaction(
        TestUtils._slotB,
        TestUtils._recipient,
        TestUtils._owner,
        TestUtils._blockNumberB,
        TestUtils._slot,
        TestUtils._hashSecretB,
        TestUtils.BobPK,
    );

    public static jsonPost = (request: any, url: string) => request!.post(url).set('Content-type', "application/json");
    public static jsonGet = (request: any, url: string) => request!.get(url).set('Accept', 'application/json');


    public static beforeEach = (done: any) => {
        async.parallel([
            (cb: any) => BlockService.deleteMany({}, cb),
            (cb: any) => TransactionService.deleteMany({}, cb),
            (cb: any) => CoinStateService.deleteMany({}, cb),
            (cb: any) => SecretRevealingBlockService.deleteMany({}, cb)
        ], done);
    };

    public static addTransaction = (request: any, slot: string | number, blockNumber: string | number, cb: CallBack<any>) => {
        const transaction = CryptoUtils.generateTransaction(
            slot.toString(),
            TestUtils._owner,
            TestUtils._recipient,
            blockNumber.toString(),
            TestUtils._privateKey);

        TestUtils.jsonPost(request, TestUtils.depositURL).send({
            "slot": slot,
            "blockNumber": blockNumber,
            "owner": TestUtils._owner
        }).expect(201)
            .then(() => {
                TestUtils.jsonPost(request, TestUtils.transactionURL)
                    .send(transaction)
                    .expect(201)
                    .then(cb)
            });
    };

    public static addDeposit = (request: any,slot: string| number, owner: string, blockNumber: string | undefined) => {
        return TestUtils.jsonPost(request, TestUtils.depositURL).send({ slot, blockNumber, owner }).expect(201)
    };

    public static revealSecret = (request: any, slot: string| number, secret: string, minedBlock: string | undefined) => {
        return TestUtils.jsonPost(request, TestUtils.revealSecretURL).send({slot, secret, minedBlock}).expect(202)
    };


    public static addSwap = (request: any, cb: CallBack<any>) => {
        TestUtils.addDeposit(request, TestUtils._slot, TestUtils.Alice, TestUtils._blockNumber).expect(201).then(() =>
            TestUtils.addDeposit(request, TestUtils._slotB, TestUtils.Bob, TestUtils._blockNumberB).expect(201).then(() =>
                TestUtils.jsonPost(request, TestUtils.atomicSwapURL).send(TestUtils._atomicSwapTransactionA).expect(201).then(() =>
                    TestUtils.jsonPost(request, TestUtils.atomicSwapURL).send(TestUtils._atomicSwapTransactionB).expect(201).then(() =>
                        cb(null)
                    )
                )
            )
        )
    };

    public static addSwapAndMine = (request: any, cb: CallBack<any>) => {
        TestUtils.addSwap(request, () => {
            TestUtils.jsonPost(request, TestUtils.mineURL).expect(201).then((response: any) => {
                cb(null)
            })
        })
    };

    public static addSwapAndMineB = (request: any, cb: CallBack<any>) => {
        TestUtils.addSwapB(request, () => {
            TestUtils.jsonPost(request, TestUtils.mineURL).expect(201).then((response: any) => {
                cb(null)
            })
        })
    };


    //Swap variables
    public static _slotA2 = TestUtils._slot + "1";
    public static _slotB2 = TestUtils._slotB + "1";
    public static _blockNumberA2 = TestUtils._blockNumber + "1";
    public static _blockNumberB2 = TestUtils._blockNumberB + "1";

    public static addSwapB = (request: any, cb: CallBack<any>) => {


        const swapB = CryptoUtils.generateAtomicSwapTransaction(
            TestUtils._slotB2,
            TestUtils._recipient,
            TestUtils._owner,
            TestUtils._blockNumberB2,
            TestUtils._slotA2,
            TestUtils._hashSecretB,
            TestUtils.BobPK,
        );

        const swapA = CryptoUtils.generateAtomicSwapTransaction(
            TestUtils._slotA2,
            TestUtils._owner,
            TestUtils._recipient,
            TestUtils._blockNumberA2,
            TestUtils._slotB2,
            TestUtils._hashSecretA,
            TestUtils._privateKey,
        );

        TestUtils.addDeposit(request, TestUtils._slotA2, TestUtils.Alice, TestUtils._blockNumberA2).expect(201).then(() =>
            TestUtils.addDeposit(request, TestUtils._slotB2, TestUtils.Bob, TestUtils._blockNumberB2).expect(201).then(() =>
                TestUtils.jsonPost(request, TestUtils.atomicSwapURL).send(swapA).expect(201).then(() =>
                    TestUtils.jsonPost(request, TestUtils.atomicSwapURL).send(swapB).expect(201).then(() =>
                        cb(null)
                    )
                )
            )
        )
    }


};