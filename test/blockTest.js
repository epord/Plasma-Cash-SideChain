const { app } = require('../server');
const request = require('supertest')(app);
const mongo = require('../mongo');
const dotenv 		= require('dotenv')

const { BlockService, TransactionService } = require('../services');


describe('Deposit', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init((err) => {
      if (err) console.log(err);
    });
  });

  beforeEach(() => {
    BlockService.remove({}, (err) => {
      if (err) console.log(err);
    });
    TransactionService.remove({}, (err) => {
      if (err) console.log(err);
    });
  });

  it("Works with a correct block", (done) => {
    return request.post("/api/blocks/deposit")
    .set('Content-type', "application/json")
    .send({
        "slot": 1,
        "blockNumber": 2,
        "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    }).expect(200, done);
  })

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
})