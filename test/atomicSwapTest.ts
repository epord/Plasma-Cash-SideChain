require('dotenv').config();
// @ts-ignore
process.env.BLOCKCHAINLESS = true;

import {TestUtils as TU} from "./TestUtils";

// @ts-ignore
import { app } from "../src/server"
import * as mongo from "../src/mongo";
import {CryptoUtils} from "../src/utils/CryptoUtils";
import {SparseMerkleTree} from "../src/utils/SparseMerkleTree";

const async = require('async');
const  request = require('supertest')(app);

describe('Transactions Works', () => {

  beforeAll(mongo.init);

  beforeEach(TU.beforeEach);

  it('Works with a correct component transaction', (done) => {
    TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
        TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
            TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then(() => done())
        )
    )
  });


  it('Does not mine it alone', (done) => {
    TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
        TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then( (_: any) =>
            TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) =>
                TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                    expect(response.body.transactions.length).toBe(0);
                    done()
                })
            )
        )
    )
  });

    it('Does mine it together', (done) => {
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) =>
                    TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionB).expect(201).then((_: any) =>
                        TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                            expect(response.body.transactions.length).toBe(2);
                            done()
                        })
                    )
                )
            )
        )
    });


    it('If two different, does not mine them together', (done) => {
        let slotA2 = TU._slot + "1";
        let slotB2 = TU._slotB + "1";
        let blockNumberA2 = TU._blockNumber + "1";
        let blockNumberB2 = TU._blockNumberB + "1";
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request, slotA2, TU.Alice, blockNumberA2).expect(201).then ( (_: any) =>
                TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                    TU.addDeposit(request,slotB2, TU.Bob, blockNumberB2).expect(201).then ( (_: any) =>
                        TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) => {
                            const swapB = CryptoUtils.generateAtomicSwapTransaction(
                                slotB2,
                                TU._recipient,
                                TU._owner,
                                blockNumberB2,
                                slotA2,
                                TU._hashSecretB,
                                TU.BobPK,
                            );

                            TU.jsonPost(request, TU.atomicSwapURL).send(swapB).expect(201).then((_: any) =>
                                TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                    expect(response.body.transactions.length).toBe(0);
                                    done()
                                })
                            )
                        })
                    )
                )
            )
        )
    });


    it('If two different, it waits for the correct one and then mine them together', (done) => {
        let slotA2 = TU._slot + "1";
        let slotB2 = TU._slotB + "1";
        let blockNumberA2 = TU._blockNumber + "1";
        let blockNumberB2 = TU._blockNumberB + "1";
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request, slotA2, TU.Alice, blockNumberA2).expect(201).then ( (_: any) =>
                TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                    TU.addDeposit(request,slotB2, TU.Bob, blockNumberB2).expect(201).then ( (_: any) =>
                        TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) => {
                            const swapB = CryptoUtils.generateAtomicSwapTransaction(
                                slotB2,
                                TU._recipient,
                                TU._owner,
                                blockNumberB2,
                                slotA2,
                                TU._hashSecretB,
                                TU.BobPK,
                            );

                            TU.jsonPost(request, TU.atomicSwapURL).send(swapB).expect(201).then((_: any) =>
                                TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                    expect(response.body.transactions.length).toBe(0);

                                    TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionB).expect(201).then((_: any) =>
                                        TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                            expect(response.body.transactions.length).toBe(2);

                                            const swapA = CryptoUtils.generateAtomicSwapTransaction(
                                                slotA2,
                                                TU._owner,
                                                TU._recipient,
                                                blockNumberA2,
                                                slotB2,
                                                TU._hashSecretA,
                                                TU._privateKey,
                                            );

                                            TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                                expect(response.body.transactions.length).toBe(0);

                                                TU.jsonPost(request, TU.atomicSwapURL).send(swapA).expect(201).then((_: any) =>
                                                    TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                                        expect(response.body.transactions.length).toBe(2);
                                                        done();
                                                    })
                                                )
                                            })
                                        })
                                    )
                                })
                            )
                        })
                    )
                )
            )
        )
    });


    it('The root hash is valid', (done) => {
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) =>
                    TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionB).expect(201).then((_: any) =>
                        TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                            const map = new Map<string, string>();
                            map.set(TU._atomicSwapTransactionA.slot, TU._atomicSwapTransactionA.hash);
                            map.set(TU._atomicSwapTransactionB.slot, TU._atomicSwapTransactionB.hash);
                            const tree = new SparseMerkleTree(64, map);
                            expect(response.body.rootHash).toBe(tree.root);
                            done()
                        })
                    )
                )
            )
        )
    });


    it('Multiple swap can be mined together', (done) => {
        let slotA2 = TU._slot + "1";
        let slotB2 = TU._slotB + "1";
        let blockNumberA2 = TU._blockNumber + "1";
        let blockNumberB2 = TU._blockNumberB + "1";

        const swapA = CryptoUtils.generateAtomicSwapTransaction(
            slotA2,
            TU._owner,
            TU._recipient,
            blockNumberA2,
            slotB2,
            TU._hashSecretA,
            TU._privateKey,
        );

        const swapB = CryptoUtils.generateAtomicSwapTransaction(
            slotB2,
            TU._recipient,
            TU._owner,
            blockNumberB2,
            slotA2,
            TU._hashSecretB,
            TU.BobPK,
        );

        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request, slotA2, TU.Alice, blockNumberA2).expect(201).then ( (_: any) =>
                TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                    TU.addDeposit(request,slotB2, TU.Bob, blockNumberB2).expect(201).then ( (_: any) =>
                        TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) =>
                            TU.jsonPost(request, TU.atomicSwapURL).send(swapB).expect(201).then((_: any) =>
                                TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionB).expect(201).then((_: any) =>
                                    TU.jsonPost(request, TU.atomicSwapURL).send(swapA).expect(201).then((_: any) =>
                                        TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                            expect(response.body.transactions.length).toBe(4);

                                            const map = new Map<string, string>();
                                            map.set(TU._atomicSwapTransactionA.slot, TU._atomicSwapTransactionA.hash);
                                            map.set(TU._atomicSwapTransactionB.slot, TU._atomicSwapTransactionB.hash);
                                            map.set(swapA.slot, swapA.hash);
                                            map.set(swapB.slot, swapB.hash);
                                            const tree = new SparseMerkleTree(64, map);
                                            expect(response.body.rootHash).toBe(tree.root);
                                            done();
                                        })
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    });

    it('Swap and basic can be mined together', (done) => {
        let slotA2 = TU._slot + "1";
        let blockNumberA2 = TU._blockNumber + "1";

        const basicTransaction = CryptoUtils.generateTransaction(
            slotA2,
            TU._owner,
            TU._recipient,
            blockNumberA2,
            TU._privateKey,
        );

        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request, slotA2, TU.Alice, blockNumberA2).expect(201).then ( (_: any) =>
                TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                    TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then((_: any) =>
                        TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionB).expect(201).then((_: any) =>
                            TU.jsonPost(request, TU.transactionURL).send(basicTransaction).expect(201).then((_: any) =>
                                TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
                                    expect(response.body.transactions.length).toBe(3);

                                    const map = new Map<string, string>();
                                    map.set(TU._atomicSwapTransactionA.slot, TU._atomicSwapTransactionA.hash);
                                    map.set(TU._atomicSwapTransactionB.slot, TU._atomicSwapTransactionB.hash);
                                    map.set(basicTransaction.slot, basicTransaction.hash);
                                    const tree = new SparseMerkleTree(64, map);
                                    expect(response.body.rootHash).toBe(tree.root);
                                    done();
                                })
                            )
                        )
                    )
                )
            )
        )
    });





});

describe('Transactions Fails', () => {

    beforeAll(mongo.init);

    beforeEach(TU.beforeEach);


    it('The token is not deposited', (done) => {
        TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( () => done())
    });

    it('The token is not deposited', (done) => {
        TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
            TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(400).then(() => done())
        )
    });

    it('If the owner does not match', (done) => {
        TU.addDeposit(request,TU._slot, TU.Carl, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(400).then(() => done())
            )
        )
    });

    it('If the blockNumber does not match', (done) => {
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber + "1").expect(201).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) =>
                TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(400).then(() => done())
            )
        )
    });

    it('If the receiving token owner does not match', (done) => {
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Carl, TU._blockNumberB).expect(201).then ( (_: any) =>
                TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(400).then(() => done())
            )
        )
    });

    it('If signature is not correct', (done) => {
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).expect(201).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).expect(201).then ( (_: any) => {
                const notRealPrivateKey = '0x97ae3b77c061e6cb62e9a80e619880c79ce42c82ad904b36899a367594066282';
                const transaction = CryptoUtils.generateAtomicSwapTransaction(
                    TU._slot,
                    TU._owner,
                    TU._recipient,
                    TU._blockNumber,
                    TU._slotB,
                    TU._hashSecretA,
                    notRealPrivateKey);
                TU.jsonPost(request, TU.atomicSwapURL).send(transaction).expect(400).then(() => done())
            })
        )
    });


});

