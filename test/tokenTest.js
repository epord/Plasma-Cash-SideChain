import {CryptoUtils} from "../src/utils/CryptoUtils";

const { app } = require('../src/server')
    , request = require('supertest')(app)
    , mongo = require('../src/mongo')
    , dotenv = require('dotenv')
    , async = require('async')
    , { generateTransaction} = require('../src/utils/cryptoUtils')
    , _ = require('lodash')
    , { BlockService, TransactionService, CoinStateService } = require('../src/services');


const transactionURL = "/api/transactions/create";
const depositURL = "/api/blocks/deposit";
const mineURL = "/api/blocks/mine";
const lastSlotOwnerURL = slot => `/api/tokens/${slot}/last-owner`;
const jsonPost = (url) => request.post(url).set('Content-type', "application/json");
const jsonGet = (url) => request.get(url).set('Accept', 'application/json');

const Alice = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
const AlicePK = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
const Bob = '0x6C7B0A12E80f1C7Aae55E0DEeEE4C4e378C2Cb4A';
const BobPK = '0xaa6d0a9653d94b802195bfd7002f5273021cf709c1e785b332f8173a8b91c487';
const Carl = '0xb9aCBd4964aBfb68c0Bb2298a92eca751e5db8Ea';
const CarlPK = '0x2ef40bc7684ea255106dbb70b272da62e7bf939b61ceb097fe37160dbd05a67e';

const _slot = "1";
const _blockNumber = "2";

const addDeposit = (slot, owner, blockNumber) => {
    return jsonPost(depositURL).send({ slot, blockNumber, owner }).expect(201)
};

describe('Token Owners', () => {

  beforeAll(done => {
    dotenv.config();
    mongo.init(done);
  });

  beforeEach((done) => {
    async.parallel([
      cb => BlockService.deleteMany({}, cb),
      cb => TransactionService.deleteMany({}, cb),
      cb => CoinStateService.deleteMany({}, cb)
    ], done);
  });

  it("Deposit's owner is correct", (done) => {
    async.waterfall([
      next => addDeposit(_slot, Alice, _blockNumber).then(() => next()),
      next => {
        jsonGet(lastSlotOwnerURL(_slot))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner).toBe(Alice.toLowerCase());
          next();
        })
      }
    ], done)
  });

  it("Slot's owner is receiver from last mined transaction", (done) => {
    async.waterfall([
      next => addDeposit(_slot, Alice, _blockNumber).then(() => next()),
      next => {
        const transaction = CryptoUtils.generateTransaction(_slot, Alice, Bob, _blockNumber, AlicePK);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next());
      },
      next => jsonPost(mineURL).expect(201).then(() => next()),
      next => {
        jsonGet(lastSlotOwnerURL(_slot))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner.toLowerCase()).toBe(Bob.toLowerCase());
          next();
        })
      }
    ], done);
  });

  it("Slot's owner do not change if transaction is not mined", (done) => {
    async.waterfall([
      next => addDeposit(_slot, Alice, _blockNumber).then(() => next()),
      next => {
        const transaction = CryptoUtils.generateTransaction(_slot, Alice, Bob, _blockNumber, AlicePK);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next());
      },
      next => {
        jsonGet(lastSlotOwnerURL(_slot))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner.toLowerCase()).toBe(Alice.toLowerCase());
          next();
        })
      }
    ], done);
  });

  it("Two transactions of the same coin works", (done) => {
    async.waterfall([
      next => addDeposit(_slot, Alice, _blockNumber).then(() => next()),
      next => {
        const transaction = CryptoUtils.generateTransaction(_slot, Alice, Bob, _blockNumber, AlicePK);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next());
      },
      next => jsonPost(mineURL).expect(201).then((ans) => {
        const minedBlockNumber = JSON.parse(ans.res.text).block_number;
        next(null, minedBlockNumber)
      }),
      (minedBlockNumber, next) => {
        const transaction = CryptoUtils.generateTransaction(_slot, Bob, Carl, minedBlockNumber, BobPK);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next());
      },
      next => jsonPost(mineURL).expect(201).then(() => next()),
      next => {
        jsonGet(lastSlotOwnerURL(_slot))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner.toLowerCase()).toBe(Carl.toLowerCase());
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
      next => addDeposit(slot1, Alice, depositBlockNumber1).expect(201).then(() => next()),
      next => addDeposit(slot2, Bob, depositBlockNumber2).expect(201).then(() => next()),
      next => {
        const transaction = CryptoUtils.generateTransaction(slot1, Alice, Carl, depositBlockNumber1, AlicePK);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next());
      },
      next => {
        const transaction = CryptoUtils.generateTransaction(slot2, Bob, Carl, depositBlockNumber2, BobPK);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next())
      },
      next => jsonPost(mineURL).expect(201).then(() => next()),
      next => {
        jsonGet(lastSlotOwnerURL(slot1))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner.toLowerCase()).toBe(Carl.toLowerCase());
          next();
        })
      },
      next => {
        jsonGet(lastSlotOwnerURL(slot2))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner.toLowerCase()).toBe(Carl.toLowerCase());
          next();
        })
      }
    ], done);
  });

});