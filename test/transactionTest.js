const { app } = require('../server')
    , request = require('supertest')(app)
    , mongo = require('../mongo')
    , dotenv = require('dotenv')
    , async = require('async')
    , _ = require('lodash')
    , CryptoUtils = require('../utils/cryptoUtils')
    , { depositBlock } = require('../services/block')
    , { BlockService, TransactionService } = require('../services');


describe('Transactions', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init((err) => {
      if (err) console.log(err);
    });
  });

  beforeEach((done) => {
    async.auto({
      clearBlocks: cb => BlockService.deleteMany({}, cb),
      clearTransactions: cb => TransactionService.deleteMany({}, cb),
      firstDeposit: ['clearBlocks' , 'clearTransactions', (res, cb) => depositBlock(1, 2, '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E', cb)],
    }, done);
  });

  it('Works with a correct transaction', (done) => {
    const slot = 1;
    const blockSpent = 2;
    const owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    const recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
    const privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    const transaction = CryptoUtils.generateTransaction(slot, owner, recipient, blockSpent, privateKey);
    return request
          .post('/api/transactions/create')
          .set('Content-type', 'application/json')
          .send(transaction)
          .expect(201, done);
  });

  it('Fails if incorrect owner', (done) => {
    const slot = 1;
    const blockSpent = 2;
    const notRealOwner = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
    const privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    const transaction = CryptoUtils.generateTransaction(slot, notRealOwner, recipient, blockSpent, privateKey);
    request
    .post('/api/transactions/create')
    .set('Content-type', 'application/json')
    .send(transaction)
    .expect(400, done);
  })

  it('Fails if slot does not exist', (done) => {
    const slot = 22;
    const blockSpent = 3;
    const owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    const recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
    const privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    const transaction = CryptoUtils.generateTransaction(slot, owner, recipient, blockSpent, privateKey);
    request
    .post('/api/transactions/create')
    .set('Content-type', 'application/json')
    .send(transaction)
    .expect(400, done);
  })

  it('Fails if blockSpent does not exist', (done) => {
    const slot = 1;
    const blockSpent = 20;
    const owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    const recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
    const privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    const transaction = CryptoUtils.generateTransaction(slot, owner, recipient, blockSpent, privateKey);
    request
    .post('/api/transactions/create')
    .set('Content-type', 'application/json')
    .send(transaction)
    .expect(400, done);
  })

  it('Fails if invalid signature', (done) => {
    const slot = 1;
    const blockSpent = 20;
    const owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
    const recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
    const privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
    const transaction = CryptoUtils.generateTransaction(slot, owner, recipient, blockSpent, privateKey);
    transaction.signature = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
    request
    .post('/api/transactions/create')
    .set('Content-type', 'application/json')
    .send(transaction)
    .expect(400, done);
  })

})