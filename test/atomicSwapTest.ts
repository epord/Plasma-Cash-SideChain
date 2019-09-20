require('dotenv').config();
// @ts-ignore
process.env.BLOCKCHAINLESS = true;

import {TestUtils as TU} from "./TestUtils";

// @ts-ignore
import { app } from "../src/server"
import * as mongo from "../src/mongo";
import {CryptoUtils} from "../src/utils/CryptoUtils";

const async = require('async');
const  request = require('supertest')(app);

describe('Transactions Works', () => {

  beforeAll(mongo.init);

  beforeEach(TU.beforeEach);

  it('Works with a correct component transaction', (done) => {
    TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).then ( (_: any) =>
        TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).then ( (_: any) =>
            TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).expect(201).then(() => done())
        )
    )
  });


  it('Does not mine it alone', (done) => {
    TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).then ( (_: any) =>
        TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).then ( (_: any) =>
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
        TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).then ( (_: any) =>
            TU.addDeposit(request,TU._slotB, TU.Bob, TU._blockNumberB).then ( (_: any) =>
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



// //FAILS Other does not own
//     it('Does not mine it alone', (done) => {
//         TU.addDeposit(request,TU._slot, TU.Alice, TU._blockNumber).then ( (_: any) =>
//             TU.jsonPost(request, TU.atomicSwapURL).send(TU._atomicSwapTransactionA).then((r: any) =>
//                 TU.jsonPost(request, TU.mineURL).expect(201).then((response: any) => {
//                     console.log(r)
//                     expect(response.body.transactions.length).toBe(0);
//                     done()
//                 })
//             )
//         )
//     });


});

