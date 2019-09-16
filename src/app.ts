import {CryptoUtils} from "./utils/CryptoUtils";

const dotenv 		= require('dotenv')
    , async 		= require('async')
    , { mineBlock }	= require('./services/block.js')
    , _ 		= require('lodash');

import {init as initMongo} from "./mongo";
import {init as initServer} from "./server";
import {init as initHooks} from "./services/hooks";


dotenv.config();

// TODO: Ver de qué tipo es cb
async.waterfall([
    (cb: any) => initMongo(cb),
    (cb: any) => initServer(cb),
    (cb: any) => initHooks(cb),
    (cb: any) => CryptoUtils.validateCryptoMons(cb),
    (cb: any) => {
        setInterval(() => {
            mineBlock((err: any) => {
                if (err) console.error(err)
            });
        }, 20000);
        cb();
    }
]);
