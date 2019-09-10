import {CryptoUtils} from "../src/utils/CryptoUtils";

const { app } = require('../src/server')
    , request = require('supertest')(app)
    , mongo = require('../src/mongo')
    , dotenv = require('dotenv')
    , async = require('async')
    , { generateTransaction} = require('../src/utils/cryptoUtils')
    , { BlockService, TransactionService, CoinStateService } = require('../src/services');


const transactionURL = "/api/transactions/create";
const depositURL = "/api/blocks/deposit";
const jsonPost = (url) => request.post(url).set('Content-type', "application/json");

const _owner = '0x6893aD12e1fCD46aB2df0De632D54Eef82FAc13E';
const _recipient = '0xf62c9Df4c6eC38b9232831548d354BB6A67985eD';
const _privateKey = '0x379717fa635d3f8b6f6e2ba65440600ed28812ef34edede5420a1befe4d0979d';
const _slot = "1";
const _blockNumber = "2";

const _transaction = CryptoUtils.generateTransaction(_slot, _owner, _recipient, _blockNumber, _privateKey);

const addDeposit = (slot, owner, blockNumber) => {
    return jsonPost(depositURL).send({
      "slot": slot,
      "blockNumber": blockNumber,
      "owner": _owner
    }).expect(201)
};

describe('Transactions Works', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init(() => {});
  });

  beforeEach((done) => {
    async.parallel([
      cb => BlockService.deleteMany({}, cb),
      cb => TransactionService.deleteMany({}, cb),
      cb => CoinStateService.deleteMany({}, cb)
    ], done);
  });

  it('Works with a correct transaction', (done) => {
    addDeposit(_slot, _owner, _blockNumber).then ( _ =>
      jsonPost(transactionURL).send(_transaction).expect(201).then(() => done())
    )
  });

});

describe('Transactions Fails', () => {

  beforeAll(() => {
    dotenv.config();
    mongo.init(_=> {});
  });

  beforeEach((done) => {
    async.parallel([
      cb => BlockService.deleteMany({}, cb),
      cb => TransactionService.deleteMany({}, cb),
      cb => CoinStateService.deleteMany({}, cb)
    ], done);
  });

  it('If incorrect owner', (done) => {
    const notRealOwner = '0x390bc8F4721CAfB8C41ab898cA81df785156bD04';
    const notRealPrivateKey = '0x97ae3b77c061e6cb62e9a80e619880c79ce42c82ad904b36899a367594066282';

    addDeposit(_slot, _owner, _blockNumber).then(_ => {
        const transaction = CryptoUtils.generateTransaction(_slot, notRealOwner, _recipient, _blockNumber, notRealPrivateKey);
        jsonPost(transactionURL).send(transaction).expect(400).then(()=> done());
      }
    );
  });

  it('If slot does not exist', (done) => {
    addDeposit("500", _owner, _blockNumber).then ( _ =>
      jsonPost(transactionURL).send(_transaction).expect(400).then(_=> done()))
  });

  it('If blockSpent does not exist', (done) => {
    addDeposit(_slot, _owner, "500").then ( _ =>
      jsonPost(transactionURL).send(_transaction).expect(400).then(_=> done()))
  });

  it('If signature is malformed', (done) => {
    addDeposit(_slot, _owner, _blockNumber).then ( _ => {
      const transaction = CryptoUtils.generateTransaction(_slot, _owner, _recipient, _blockNumber, _privateKey);
      transaction.signature = '0x1';
      jsonPost(transactionURL).send(transaction).expect(400).then(_=> done())
    });
  });

  it('If signature is invalid', (done) => {
    addDeposit(_slot, _owner, _blockNumber).then ( _ => {
      const transaction = CryptoUtils.generateTransaction(_slot, _owner, _recipient, _blockNumber, _privateKey);
      transaction.signature = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      jsonPost(transactionURL).send(transaction).expect(400).then(_=> done())
    });
  });

  it('If signature is not correct', (done) => {
    addDeposit(_slot, _owner, _blockNumber).then ( _ => {
      const notRealPrivateKey = '0x97ae3b77c061e6cb62e9a80e619880c79ce42c82ad904b36899a367594066282';
      const transaction = CryptoUtils.generateTransaction(_slot, _owner, _recipient, _blockNumber, notRealPrivateKey);
      jsonPost(transactionURL).send(transaction).expect(400).then(_=> done())
    });
  });

});