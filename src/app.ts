import {CryptoUtils} from "./utils/CryptoUtils";
import {init as initMongo} from "./mongo";
import {init as initServer} from "./server";
import {init as initWebSocket} from "./websocket";
import {init as initHooks} from "./services/hooks";
import {mineBlock} from "./services/block";

const dotenv 		= require('dotenv')
    , async 		= require('async')
    , _ 		    = require('lodash');


dotenv.config();

async.waterfall([
    (cb: any) => {
        if(process.env.BLOCKCHAINLESS) return cb();
        setInterval(() => {
            mineBlock((err: any) => {
                if (err) console.error(err)
            });
        }, 20000);
        cb();
    },
    (cb: any) => CryptoUtils.validateCryptoMons(cb),
    (cb: any) => initMongo(cb),
    (cb: any) => initServer(cb),
    (cb: any) => initHooks(cb),
    (cb: any) => initWebSocket(cb),
]);
