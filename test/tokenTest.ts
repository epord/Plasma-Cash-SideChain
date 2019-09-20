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

describe('Token Owners', () => {

  beforeAll(mongo.init);
  beforeEach(TU.beforeEach);

  it("Deposit's owner is correct", (done) => {
    async.waterfall([
      (next: any) => TU.addDeposit(request, TU._slot, TU.Alice, TU._blockNumber).then(() => next()),
      (next: any) => {
        TU.jsonGet(request, TU.lastSlotOwnerURL(TU._slot))
        .expect(200)
        .then((response: any) => {
          expect(response.body.lastOwner).toBe(TU.Alice.toLowerCase());
          next();
        })
      }
    ], done)
  });

  it("Slot's owner is receiver from last mined transaction", (done) => {
    async.waterfall([
      (next: any) => TU.addDeposit(request, TU._slot, TU.Alice, TU._blockNumber).then(() => next()),
      (next: any) => {
        const transaction = CryptoUtils.generateTransaction(TU._slot, TU.Alice, TU.Bob, TU._blockNumber, TU.AlicePK);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(201).then(() => next());
      },
      (next: any) => TU.jsonPost(request, TU.mineURL).expect(201).then(() => next()),
      (next: any) => {
        TU.jsonGet(request, TU.lastSlotOwnerURL(TU._slot))
        .expect(200)
        .then((response: any) => {
          expect(response.body.lastOwner.toLowerCase()).toBe(TU.Bob.toLowerCase());
          next();
        })
      }
    ], done);
  });

  it("Slot's owner do not change if transaction is not mined", (done) => {
    async.waterfall([
      (next: any) => TU.addDeposit(request, TU._slot, TU.Alice, TU._blockNumber).then(() => next()),
      (next: any) => {
        const transaction = CryptoUtils.generateTransaction(TU._slot, TU.Alice, TU.Bob, TU._blockNumber, TU.AlicePK);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(201).then(() => next());
      },
      (next: any) => {
        TU.jsonGet(request, TU.lastSlotOwnerURL(TU._slot))
        .expect(200)
        .then((response: any) => {
          expect(response.body.lastOwner.toLowerCase()).toBe(TU.Alice.toLowerCase());
          next();
        })
      }
    ], done);
  });

  it("Two transactions of the same coin works", (done) => {
    async.waterfall([
      (next: any) => TU.addDeposit(request, TU._slot, TU.Alice, TU._blockNumber).then(() => next()),
      (next: any) => {
        const transaction = CryptoUtils.generateTransaction(TU._slot, TU.Alice, TU.Bob, TU._blockNumber, TU.AlicePK);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(201).then(() => next());
      },
      (next: any) => TU.jsonPost(request, TU.mineURL).expect(201).then((ans: any) => {
        const minedBlockNumber = JSON.parse(ans.res.text).blockNumber;
        next(null, minedBlockNumber)
      }),
      (minedBlockNumber: string, next: any) => {
        const transaction = CryptoUtils.generateTransaction(TU._slot, TU.Bob, TU.Carl, minedBlockNumber, TU.BobPK);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(201).then(() => next());
      },
      (next: any) => TU.jsonPost(request, TU.mineURL).expect(201).then(() => next()),
      (next: any) => {
        TU.jsonGet(request, TU.lastSlotOwnerURL(TU._slot))
        .expect(200)
        .then((response: any) => {
          expect(response.body.lastOwner.toLowerCase()).toBe(TU.Carl.toLowerCase());
          next();
        })
      }
    ], done);
  });

  it("Two transactions of different coins works", (done) => {
    const slot1 = "1";
    const slot2 = "2";
    const depositBlockNumber1 = "1";
    const depositBlockNumber2 = "2";
    async.waterfall([
      (next: any) => TU.addDeposit(request, slot1, TU.Alice, depositBlockNumber1).expect(201).then(() => next()),
      (next: any) => TU.addDeposit(request, slot2, TU.Bob, depositBlockNumber2).expect(201).then(() => next()),
      (next: any) => {
        const transaction = CryptoUtils.generateTransaction(slot1, TU.Alice, TU.Carl, depositBlockNumber1, TU.AlicePK);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(201).then(() => next());
      },
      (next: any) => {
        const transaction = CryptoUtils.generateTransaction(slot2, TU.Bob, TU.Carl, depositBlockNumber2, TU.BobPK);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(201).then(() => next())
      },
      (next: any) => TU.jsonPost(request, TU.mineURL).expect(201).then(() => next()),
      (next: any) => {
        TU.jsonGet(request, TU.lastSlotOwnerURL(slot1))
        .expect(200)
        .then((response: any) => {
          expect(response.body.lastOwner.toLowerCase()).toBe(TU.Carl.toLowerCase());
          next();
        })
      },
      (next: any) => {
        TU.jsonGet(request, TU.lastSlotOwnerURL(slot2))
        .expect(200)
        .then((response: any) => {
          expect(response.body.lastOwner.toLowerCase()).toBe(TU.Carl.toLowerCase());
          next();
        })
      }
    ], done);
  });

});