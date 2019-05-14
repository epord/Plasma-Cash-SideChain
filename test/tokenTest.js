const { app } = require('../server')
    , request = require('supertest')(app)
    , mongo = require('../mongo')
    , dotenv = require('dotenv')
    , async = require('async')
    , { generateTransaction} = require('../utils/cryptoUtils')
    , _ = require('lodash')
    , { BlockService, TransactionService } = require('../services');


const transactionURL = "/api/transactions/create";
const depositURL = "/api/blocks/deposit";
const mineURL = "/api/blocks/mine";
const lastSlotOwnerURL = slot => `/api/tokens/${slot}/last-owner`;
const jsonPost = (url) => request.post(url).set('Content-type', "application/json");
const jsonGet = (url) => request.get(url).set('Accept', 'application/json');

const _owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
const _recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
const _privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
const _slot = "1";
const _blockNumber = "2";

const addDeposit = (slot, owner, blockNumber) => {
    return jsonPost(depositURL).send({
      "slot": slot,
      "blockNumber": blockNumber,
      "owner": _owner
    }).expect(201)
};

describe('Token Owners', () => {

  beforeAll(done => {
    dotenv.config();
    mongo.init(done);
  });

  beforeEach((done) => {
    async.parallel([
      cb => BlockService.deleteMany({}, cb),
      cb => TransactionService.deleteMany({}, cb)
    ], done);
  });

  it("Deposit's owner is correct", (done) => {
    async.waterfall([
      next => addDeposit(_slot, _owner, _blockNumber).then(() => next()),
      next => {
        jsonGet(lastSlotOwnerURL(_slot))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner).toBe(_owner);
          next()
        })
      }
    ], done)
  });

  it("Slot's owner is receiver from last mined transaction", (done) => {
    const Alice = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    const Bob   = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13F';
    async.waterfall([
      next => addDeposit(_slot, Alice, _blockNumber).then(() => next()),
      next => {
        const transaction = generateTransaction(_slot, Alice, Bob, _blockNumber, _privateKey);
        jsonPost(transactionURL).send(transaction).expect(201).then(() => next());
      },
      next => jsonPost(mineURL).expect(201).then(() => next()),
      next => {
        jsonGet(lastSlotOwnerURL(_slot))
        .expect(200)
        .then(response => {
          expect(response.body.last_owner.toLowerCase()).toBe(Bob.toLowerCase());
          next()
        })
      }
    ], done);
  });

});