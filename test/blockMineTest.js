require('dotenv').config();
process.env.BLOCKCHAINLESS = true;
import { app } from "../src/server"

import {CryptoUtils} from "../src/utils/CryptoUtils";
const request = require('supertest')(app),
  mongo = require('../src/mongo'),
  async = require('async'),
  dotenv 		= require('dotenv'),
  { BlockService, TransactionService, CoinStateService } = require('../src/services');

const jsonPost = (url) => request.post(url).set('Content-type', "application/json");
const depositURL = "/api/blocks/deposit";
const mineURL = "/api/blocks/mine";
const transactionURL = "/api/transactions/create";

describe('Mining Works', () => {

  const owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
  const recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
  const privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';

  const addTransaction = (slot, blockNumber, cb) => {
    const transaction = CryptoUtils.generateTransaction(slot, owner, recipient, blockNumber, privateKey);

    jsonPost(depositURL).send({
      "slot": slot,
      "blockNumber": blockNumber,
      "owner": owner
    }).expect(201)
      .then(_ => {
        jsonPost(transactionURL)
          .send(transaction)
          .expect(201)
          .then(cb)
      });
  };

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

  it("With an empty block", (done) => {
    return request.post(mineURL)
      .expect(201)
      .then(response =>
        request.get("/api/blocks/" + response.body.blockNumber)
          .expect(200).then((response) => {
          expect(response.body.transactions.length).toBe(0);
          expect(response.body.blockNumber).toBe("1000");
          done()
        })
      )
  });

  it("With a transaction", (done) => {
    return addTransaction(1, 2, _ => {
      request.post(mineURL)
        .expect(201)
        .then(response => {
          expect(response.body.transactions.length).toBe(1);
          done();
        });
    });
  });

  it("With Multiple transactions", (done) => {
    return addTransaction(1, 2, _ => {
      addTransaction(2, 3, _ => {
        request.post(mineURL)
          .expect(201)
          .then(response => {
            expect(response.body.transactions.length).toBe(2);
            done();
          });
      });
    });
  });

  it("Twice in a row", (done) => {
    return request.post(mineURL)
      .expect(201)
      .then(response => {
        expect(response.body.transactions.length).toBe(0);
        expect(response.body.blockNumber).toBe("1000");
        request.post(mineURL)
          .expect(201)
          .then(response => {
            expect(response.body.transactions.length).toBe(0);
            expect(response.body.blockNumber).toBe("2000");
            done()
          });
      });
  });

  it("Twice with transactions", (done) => {
    return addTransaction(1, 2, _ => {
      request.post(mineURL)
        .expect(201)
        .then(response => {
          expect(response.body.transactions.length).toBe(1);
          expect(response.body.transactions[0].slot).toBe("1");
          expect(response.body.blockNumber).toBe("1000");
          addTransaction(2, 3, _ => {
            request.post(mineURL)
              .expect(201)
              .then(response => {
                expect(response.body.transactions.length).toBe(1);
                expect(response.body.transactions[0].slot).toBe("2");
                expect(response.body.blockNumber).toBe("2000");
                done()
              });
          });
        });
    });
  });

  it("With the correct Number", (done) => {
    return addTransaction(1, 2, _ => {
      request.post(mineURL)
        .expect(201)
        .then(response => {
          expect(response.body.transactions.length).toBe(1);
          expect(response.body.transactions[0].slot).toBe("1");
          expect(response.body.blockNumber).toBe("1000");
          addTransaction(2, 3, _ => {
            request.post(mineURL)
              .expect(201)
              .then(response => {
                expect(response.body.transactions.length).toBe(1);
                expect(response.body.transactions[0].slot).toBe("2");
                expect(response.body.blockNumber).toBe("2000");
                addTransaction(3, 1001, _ => {
                  request.post(mineURL)
                    .expect(201)
                    .then(response => {
                      expect(response.body.transactions.length).toBe(1);
                      expect(response.body.transactions[0].slot).toBe("3");
                      expect(response.body.blockNumber).toBe("3000");
                      addTransaction(4, 5001, _ => {
                        request.post(mineURL)
                          .expect(201)
                          .then(response => {
                            expect(response.body.transactions.length).toBe(1);
                            expect(response.body.transactions[0].slot).toBe("4");
                            expect(response.body.blockNumber).toBe("6000");
                            done()
                          });
                      });
                    });
                });
              });
          });
        });
    });
  });

  it("With the correct Number after deposit", (done) => {
    return addTransaction(1, 2, _ => {
      request.post(mineURL)
        .expect(201)
        .then(response => {
          expect(response.body.transactions.length).toBe(1);
          expect(response.body.transactions[0].slot).toBe("1");
          expect(response.body.blockNumber).toBe("1000");
          addTransaction(2, 7500, _ => {
            request.post(mineURL)
              .expect(201)
              .then(response => {
                expect(response.body.transactions.length).toBe(1);
                expect(response.body.transactions[0].slot).toBe("2");
                expect(response.body.blockNumber).toBe("8000");
                done();
              });
          });
        });
    });
  });

});

