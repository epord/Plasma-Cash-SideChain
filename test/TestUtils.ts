import {CryptoUtils} from "../src/utils/CryptoUtils";
import { BlockService, TransactionService, CoinStateService, SecretRevealingBlockService } from '../src/services';
import {CallBack} from "../src/utils/TypeDef";
const async = require('async');

export class TestUtils {

    public static _owner        = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    public static _recipient    = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
    public static _privateKey   = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    public static _slot         = "1";
    public static _blockNumber  = "2";

    public static transactionURL    = "/api/transactions/create";
    public static depositURL        = "/api/blocks/deposit";
    public static blocksURL = "/api/blocks/";
    public static mineURL = "/api/blocks/mine";


    public static Alice = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    public static AlicePK = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    public static Bob = '0x6C7B0A12E80f1C7Aae55E0DEeEE4C4e378C2Cb4A';
    public static BobPK = '0xaa6d0a9653d94b802195bfd7002f5273021cf709c1e785b332f8173a8b91c487';
    public static Carl = '0xb9aCBd4964aBfb68c0Bb2298a92eca751e5db8Ea';
    public static CarlPK = '0x2ef40bc7684ea255106dbb70b272da62e7bf939b61ceb097fe37160dbd05a67e';


    public static lastSlotOwnerURL = (slot: string) => `/api/tokens/${slot}/last-owner`;

    public static _transaction = CryptoUtils.generateTransaction(
        TestUtils._slot,
        TestUtils._owner,
        TestUtils._recipient,
        TestUtils._blockNumber,
        TestUtils._privateKey);


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
            .then((_: any) => {
                TestUtils.jsonPost(request, TestUtils.transactionURL)
                    .send(transaction)
                    .expect(201)
                    .then(cb)
            });
    };

    public static addDeposit = (request: any,slot: string| number, owner: string, blockNumber: string | undefined) => {
        return TestUtils.jsonPost(request, TestUtils.depositURL).send({ slot, blockNumber, owner }).expect(201)
    };




}