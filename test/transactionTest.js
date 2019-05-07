const { app } = require('../server')
    , request = require('supertest')(app)
    , mongo = require('../mongo')
    , dotenv = require('dotenv')
    , async = require('async')
    , _ = require('lodash');

const { BlockService, TransactionService } = require('../services');


describe('Deposit', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init((err) => {
      if (err) console.log(err);
    });
  });

  beforeEach((cb) => {
    async.parallel([
      cb => BlockService.remove({}, cb),
      cb => TransactionService.remove({}, cb)
    ], cb)

  });

  it("Works with a correct transaction", (done) => {
    return request.post("/api/transactions/create")
    .set('Content-type', "application/json")
    .send({
      "slot": 1,
      "blockNumber": 2,
      "owner": '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD'
    }).expect(200, done);
  })

})