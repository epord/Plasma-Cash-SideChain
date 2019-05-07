const { app } = require('../server');
const request = require('supertest')(app);
const mongo = require('../mongo');
const dotenv 		= require('dotenv');
const { logErr } = require("../utils/utils");
const { BigNumber } = require("bignumber.js");

const { BlockService, TransactionService } = require('../services');


describe('Deposit', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init(logErr);
  });

  beforeEach(() => {
    BlockService.remove({}, logErr);
    TransactionService.remove({},logErr);
  });

  it("Works with a correct block", (done) => {
    return request.post("/api/blocks/deposit")
      .set('Content-type', "application/json")
      .send({
        "blockNumber": 2,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      }).expect(400, done);
  });

  it("Works with a really big numbers", (done) => {
    const blockNumber = "90000000000000000001";
    const slot = new BigNumber("10000000000000000000");

    return request.post("/api/blocks/deposit")
      .set('Content-type', "application/json")
      .send({
        "slot": slot.toFixed(),
        "blockNumber": blockNumber,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      }).expect(201).then( response => {
        expect(response.body.block_number).toBe(blockNumber);
        expect(response.body.transactions[0]).toBe(generateDepositBlockRootHash(slot));
        expect(response.body.transactions.length).toBe(1);


        return request.get("/api/blocks/" + response.body.block_number)
          .expect(200).then((response) => {
            expect(response.body.transactions.length).toBe(1);
            expect(response.body.transactions[0]).toBe(generateDepositBlockRootHash(slot));
            expect(response.body.block_number).toBe(response.body.blockNumber);
            done()
          })
      });
  });


  it("Fails on missing blockNumber", (done) => {
    return request.post("/api/blocks/deposit")
      .set('Content-type', "application/json")
      .send({
        "slot": 1,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      }).expect(400, done);
  });

  it("Fails on missing owner", (done) => {
    return request.post("/api/blocks/deposit")
      .set('Content-type', "application/json")
      .send({
        "slot": 1,
        "blockNumber": 2,
      }).expect(400, done);
  });

  it("Fails on missing slot", (done) => {
    return request.post("/api/blocks/deposit")
      .set('Content-type', "application/json")
      .send({
        "slot": 1,
        "blockNumber": 2,
      }).expect(400, done);
  });

  it("Fails on repeated deposit", (done) => {
    request
      .post("/api/blocks/deposit")
      .set('Content-type', "application/json")
      .send({
        "slot": 1,
        "blockNumber": 2,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
      }).then(() => {
      request
        .post("/api/blocks/deposit")
        .set('Content-type', "application/json")
        .send({
          "slot": 1,
          "blockNumber": 2,
          "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
        })
        .expect(400, done);
    })
  });

});


describe('Mining', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init(logErr);
  });

  beforeEach(() => {
    BlockService.remove({}, logErr);
    TransactionService.remove({},logErr);
  });

  it("Mines an empty block", (done) => {
    return request.post("/api/blocks/mine")
      .expect(201)
      .then( response =>
        request.get("/api/blocks/" + response.body.block_number)
           .expect(200).then((response) => {
             expect(response.body.transactions.length).toBe(0);
             expect(response.body.block_number).toBe("1000");
             done()
        })
      )
  });

});