require('dotenv').config();
process.env.BLOCKCHAINLESS = true;
import { app } from "../src/server"

const  request = require('supertest')(app),
  mongo = require('../src/mongo'),
  async = require('async'),
  EthUtils	= require('ethereumjs-util'),
  BN = require('bn.js'),
  { BlockService, TransactionService, CoinStateService } = require('../src/services');

const jsonPost = (url) => request.post(url).set('Content-type', "application/json");
const jsonGet = (url) => request.get(url).set('Accept', 'application/json');
const blocksURL = "/api/blocks/";
const depositURL = "/api/blocks/deposit";
const mineURL = "/api/blocks/mine";
const transactionURL = "/api/transactions/create";
const lastSlotOwnerURL = slot => `/api/tokens/${slot}/last-owner`;

describe('Deposit Works', () => {

  beforeAll(() => {
    mongo.init(() => {});
  });

  beforeEach((done) => {
    async.parallel([
      cb => BlockService.deleteMany({}, cb),
      cb => TransactionService.deleteMany({}, cb)
      ], done);
  });

  it("With a correct block", (done) => {
    return jsonPost(depositURL).send({
        "slot": 123,
        "blockNumber": 2,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      })
      .expect(201, done);
  });

  it("With really big numbers", (done) => {
    const blockNumber = "90000000000000000001";
    const slot = "10000000000000000000";

    const rootHash = EthUtils.bufferToHex(EthUtils.keccak256(
      EthUtils.setLengthLeft(new BN(slot).toBuffer(), 64/8), 		// uint64 little endian
    ));

    return jsonPost(depositURL).send({
        "slot": slot,
        "blockNumber": blockNumber,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      }).expect(201)

      .then( response => {
        expect(response.body.blockNumber).toBe(blockNumber);
        expect(response.body.transactions[0].slot).toBe(slot);

        return request.get("/api/blocks/" + response.body.blockNumber)
          .expect(200)

          .then((response) => {
            expect(response.body.transactions.length).toBe(1);
            expect(response.body.rootHash).toBe(rootHash);
            done()
          })
      });
  });

  it("With 2 deposits back to back", (done) => {
    return jsonPost(depositURL).send({
      "slot": 123,
      "blockNumber": 2,
      "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    })
    .expect(201)
    .then( _ => {
      jsonPost(depositURL).send({
        "slot": 124,
        "blockNumber": 3,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'

      })
      .expect(201)
      .then( _ => {
        request.get(blocksURL)
          .expect(200)
          .then( response => {
            expect(response.body.length).toBe(2);
            const blockNumbers = response.body.map(b => b.blockNumber).sort();
            expect(blockNumbers[0]).toBe("2");
            expect(blockNumbers[1]).toBe("3");
            done();
          });
      });
    })
  });

  it("Depositing a previous block", (done) => {
    return jsonPost(depositURL).send({
      "slot": 123,
      "blockNumber": 5,
      "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    })
      .expect(201)
      .then( _ => {
        jsonPost(depositURL).send({
          "slot": 124,
          "blockNumber": 3,
          "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'

        })
          .expect(201)
          .then( _ => {
            request.get(blocksURL)
              .expect(200)
              .then( response => {
                expect(response.body.length).toBe(2);
                const blockNumbers = response.body.map(b => b.blockNumber).sort();
                expect(blockNumbers[0]).toBe("3");
                expect(blockNumbers[1]).toBe("5");
                done();
              });
          });
      })
  });

  it("Two independent deposits", done => {
    async.waterfall([
      next =>  {
        jsonPost(depositURL)
        .send({
          slot: 123,
          blockNumber: 5,
          owner: '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
        })
        .expect(201)
        .then(() => next())
      },
      next => {
        jsonPost(depositURL)
        .send({
          slot: 124,
          blockNumber: 6,
          owner: '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E'
        })
        .expect(201)
        .then(() => next())
      },
      next => {
        jsonGet(lastSlotOwnerURL(123))
        .expect(200)
        .then(response => {
          expect(response.body.lastOwner.toLowerCase()).toBe('0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'.toLowerCase());
          next();
        })
      },
      next => {
        jsonGet(lastSlotOwnerURL(124))
        .expect(200)
        .then(response => {
          expect(response.body.lastOwner.toLowerCase()).toBe('0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E'.toLowerCase());
          next();
        })
      },
    ], done);
  })

});

describe('Deposit Fails', () => {

  beforeAll(() => {
    mongo.init(() => {});
  });

  beforeEach((done) => {
    async.parallel([
      cb => BlockService.deleteMany({}, cb),
      cb => TransactionService.deleteMany({}, cb),
      cb => CoinStateService.deleteMany({}, cb)
    ], done);
  });

  it("On missing blockNumber", (done) => {
    return jsonPost(depositURL).send({
      "slot": 1,
      "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    })
      .expect(400, done);
  });

  it("On missing owner", (done) => {
    return jsonPost(depositURL).send({
      "slot": 1,
      "blockNumber": 2,
    })
      .expect(400, done);
  });

  it("On missing slot", (done) => {
    return jsonPost(depositURL).send({
      "slot": 1,
      "blockNumber": 2,
    })
      .expect(400, done);
  });

  it("On a duplicated blockNumber", (done) => {
    jsonPost(depositURL).send({
      "slot": 1,
      "blockNumber": 2,
      "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    })
    .expect(201)
    .then(() => {
      jsonPost(depositURL).send({
        "slot": 5,
        "blockNumber": 2,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      })
        .expect(409, done);
    })
  });

  it("On duplicated slot deposit", (done) => {
    jsonPost(depositURL).send({
      "slot": 1,
      "blockNumber": 2,
      "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    })

      .then(() => {
        jsonPost(depositURL).send({
          "slot": 1,
          "blockNumber": 5,
          "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
        })
          .expect(400, done);
      })
  });

});

