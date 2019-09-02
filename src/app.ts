const dotenv 		= require('dotenv')
    , async 		= require('async')
    , cryptoUtils = require("./utils/cryptoUtils")
    , { mineBlock }	= require('./services/block')
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
    (cb: any) => cryptoUtils.validateCryptoMons(cb),
    (cb: any) => {
        setInterval(() => {
            mineBlock(_.noop)
        }, 20000);
        cb();
    }
]);
