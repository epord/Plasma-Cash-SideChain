require('dotenv').config();
// @ts-ignore
process.env.BLOCKCHAINLESS = true;

import {TestUtils as TU} from "./TestUtils";

// @ts-ignore
import { app } from "../src/server"
import * as mongo from "../src/mongo";

const  request = require('supertest')(app);

describe('Mining Works', () => {

  beforeAll(mongo.init);
  beforeEach(TU.beforeEach);

  it("With an empty block", (done) => {
    return request.post(TU.mineURL)
      .expect(201)
      .then((response: any) =>
        request.get("/api/blocks/" + response.body.blockNumber)
          .expect(200).then((response: any) => {
          expect(response.body.transactions.length).toBe(0);
          expect(response.body.blockNumber).toBe("1000");
          done()
        })
      )
  });

  it("With a transaction", (done) => {
    return TU.addTransaction(request, 1, 2, (_: any) => {
      request.post(TU.mineURL)
        .expect(201)
        .then((response: any) => {
          expect(response.body.transactions.length).toBe(1);
          done();
        });
    });
  });

  it("With Multiple transactions", (done) => {
    return TU.addTransaction(request, 1, 2, (_: any) => {
      TU.addTransaction(request, 2, 3, (_: any) => {
        request.post(TU.mineURL)
          .expect(201)
          .then((response: any) => {
            expect(response.body.transactions.length).toBe(2);
            done();
          });
      });
    });
  });

  it("Twice in a row", (done) => {
    return request.post(TU.mineURL)
      .expect(201)
      .then((response: any) => {
        expect(response.body.transactions.length).toBe(0);
        expect(response.body.blockNumber).toBe("1000");
        request.post(TU.mineURL)
          .expect(201)
          .then((response: any) => {
            expect(response.body.transactions.length).toBe(0);
            expect(response.body.blockNumber).toBe("2000");
            done()
          });
      });
  });

  it("Twice with transactions", (done) => {
    return TU.addTransaction(request, 1, 2, (_: any) => {
      request.post(TU.mineURL)
        .expect(201)
        .then((response: any) => {
          expect(response.body.transactions.length).toBe(1);
          expect(response.body.transactions[0].slot).toBe("1");
          expect(response.body.blockNumber).toBe("1000");
          TU.addTransaction(request, 2, 3, (_: any) => {
            request.post(TU.mineURL)
              .expect(201)
              .then((response: any) => {
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
    return TU.addTransaction(request, 1, 2, (_: any) => {
      request.post(TU.mineURL)
        .expect(201)
        .then((response: any) => {
          expect(response.body.transactions.length).toBe(1);
          expect(response.body.transactions[0].slot).toBe("1");
          expect(response.body.blockNumber).toBe("1000");
          TU.addTransaction(request, 2, 3, (_: any) => {
            request.post(TU.mineURL)
              .expect(201)
              .then((response: any) => {
                expect(response.body.transactions.length).toBe(1);
                expect(response.body.transactions[0].slot).toBe("2");
                expect(response.body.blockNumber).toBe("2000");
                TU.addTransaction(request, 3, 1001, (_: any) => {
                  request.post(TU.mineURL)
                    .expect(201)
                    .then((response: any) => {
                      expect(response.body.transactions.length).toBe(1);
                      expect(response.body.transactions[0].slot).toBe("3");
                      expect(response.body.blockNumber).toBe("3000");
                      TU.addTransaction(request, 4, 5001, (_: any) => {
                        request.post(TU.mineURL)
                          .expect(201)
                          .then((response: any) => {
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
    return TU.addTransaction(request, 1, 2, (_: any) => {
      request.post(TU.mineURL)
        .expect(201)
        .then((response: any) => {
          expect(response.body.transactions.length).toBe(1);
          expect(response.body.transactions[0].slot).toBe("1");
          expect(response.body.blockNumber).toBe("1000");
          TU.addTransaction(request, 2, 7500, (_: any) => {
            request.post(TU.mineURL)
              .expect(201)
              .then((response: any) => {
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

