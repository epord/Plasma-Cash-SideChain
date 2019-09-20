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

describe('Transactions Works', () => {

  beforeAll(mongo.init);

  beforeEach(TU.beforeEach);

  it('Works with a correct transaction', (done) => {
    TU.addDeposit(request,TU._slot, TU._owner, TU._blockNumber).then ( (_: any) =>
      TU.jsonPost(request, TU.transactionURL).send(TU._transaction).expect(201).then(() => done())
    )
  });

});

describe('Transactions Fails', () => {

  beforeAll(mongo.init);
  beforeEach(TU.beforeEach);

  it('If incorrect owner', (done) => {
    const notRealOwner = '0x390bc8F4721CAfB8C41ab898cA81df785156bD04';
    const notRealPrivateKey = '0x97ae3b77c061e6cb62e9a80e619880c79ce42c82ad904b36899a367594066282';

    TU.addDeposit(request,TU._slot, TU._owner, TU._blockNumber).then((_: any) => {
        const transaction = CryptoUtils.generateTransaction(TU._slot, notRealOwner, TU._recipient, TU._blockNumber, notRealPrivateKey);
        TU.jsonPost(request, TU.transactionURL).send(transaction).expect(400).then(()=> done());
      }
    );
  });

  it('If slot does not exist', (done) => {
    TU.addDeposit(request,"500", TU._owner, TU._blockNumber).then ( (_: any) =>
      TU.jsonPost(request, TU.transactionURL).send(TU._transaction).expect(400).then((_: any)=> done()))
  });

  it('If blockSpent does not exist', (done) => {
    TU.addDeposit(request,TU._slot, TU._owner, "500").then ( (_: any) =>
      TU.jsonPost(request, TU.transactionURL).send(TU._transaction).expect(400).then((_: any)=> done()))
  });

  it('If signature is malformed', (done) => {
    TU.addDeposit(request,TU._slot, TU._owner, TU._blockNumber).then ( (_: any) => {
      const transaction = CryptoUtils.generateTransaction(TU._slot, TU._owner, TU._recipient, TU._blockNumber, TU._privateKey);
      transaction.signature = '0x1';
      TU.jsonPost(request, TU.transactionURL).send(transaction).expect(400).then((_: any)=> done())
    });
  });

  it('If signature is invalid', (done) => {
    TU.addDeposit(request,TU._slot, TU._owner, TU._blockNumber).then ( (_: any) => {
      const transaction = CryptoUtils.generateTransaction(TU._slot, TU._owner, TU._recipient, TU._blockNumber, TU._privateKey);
      transaction.signature = '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      TU.jsonPost(request, TU.transactionURL).send(transaction).expect(400).then((_: any)=> done())
    });
  });

  it('If signature is not correct', (done) => {
    TU.addDeposit(request,TU._slot, TU._owner, TU._blockNumber).then ( (_: any) => {
      const notRealPrivateKey = '0x97ae3b77c061e6cb62e9a80e619880c79ce42c82ad904b36899a367594066282';
      const transaction = CryptoUtils.generateTransaction(TU._slot, TU._owner, TU._recipient, TU._blockNumber, notRealPrivateKey);
      TU.jsonPost(request, TU.transactionURL).send(transaction).expect(400).then((_: any)=> done())
    });
  });

});