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

    it('Revealing a correct secret', (done) => {
        TU.addSwapAndMine(request, () =>
            TU.revealSecret(request, TU._atomicSwapTransactionA.slot, TU._secretA, "1000")
                .then(() => done()))

    });

    it('Revealing a both secrets', (done) => {
        TU.addSwapAndMine(request, () =>
            TU.revealSecret(request, TU._atomicSwapTransactionA.slot, TU._secretA, "1000").then(() =>
                TU.revealSecret(request, TU._atomicSwapTransactionB.slot, TU._secretB, "1000").then(() =>  done())
            )
        )
    });

    it('Revealing one secret does not submit a block', (done) => {
        TU.addSwapAndMine(request, () =>
            TU.revealSecret(request, TU._atomicSwapTransactionA.slot, TU._secretA, "1000").then(() =>
                TU.jsonGet(request, TU.secretBlockURL("1000")).then((response: any) => {
                    expect(response.body.blockNumber).toBe("1000");
                    expect(response.body.isSubmitted).toBe(false);
                    done()
                })
            )
        )
    });

    it('Revealing a both secrets submits a block', (done) => {
        TU.addSwapAndMine(request, () =>
            TU.revealSecret(request, TU._atomicSwapTransactionA.slot, TU._secretA, "1000").then(() =>
                TU.revealSecret(request, TU._atomicSwapTransactionB.slot, TU._secretB, "1000").then(() =>
                    TU.jsonGet(request, TU.secretBlockURL("1000")).then((response: any) => {
                    expect(response.body.blockNumber).toBe("1000");
                    expect(response.body.isSubmitted).toBe(true);
                    done()
                    })
                )
            )
        )
    });

    it('Revealing a 3 of 4 secrets does not submit a block', (done) => {
        TU.addSwap(request, () =>
            TU.addSwapAndMineB(request,() =>
                TU.revealSecret(request, TU._atomicSwapTransactionA.slot, TU._secretA, "1000").then(() =>
                TU.revealSecret(request, TU._atomicSwapTransactionB.slot, TU._secretB, "1000").then(() =>
                TU.revealSecret(request, TU._slotA2, TU._secretA, "1000").then(() =>

                    TU.jsonGet(request, TU.secretBlockURL("1000")).then((response: any) => {
                        expect(response.body.blockNumber).toBe("1000");
                        expect(response.body.isSubmitted).toBe(false);
                        done()
                    })
                )))
            )
        )
    });

    it('Revealing a 4 of 4 secrets does not submit a block', (done) => {
        TU.addSwap(request, () =>
            TU.addSwapAndMineB(request,() =>
                TU.revealSecret(request, TU._atomicSwapTransactionA.slot, TU._secretA, "1000").then(() =>
                    TU.revealSecret(request, TU._atomicSwapTransactionB.slot, TU._secretB, "1000").then(() =>
                        TU.revealSecret(request, TU._slotA2, TU._secretA, "1000").then(() =>
                        TU.revealSecret(request, TU._slotB2, TU._secretB, "1000").then(() =>

                            TU.jsonGet(request, TU.secretBlockURL("1000")).then((response: any) => {
                                expect(response.body.blockNumber).toBe("1000");
                                expect(response.body.isSubmitted).toBe(true);
                                done()
                            })
                        ))))
            )
        )
    });

});