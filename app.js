const dotenv 		= require('dotenv')
		, async 		= require('async')
		, mongo 		= require('./mongo')
		, server 		= require('./server')
		, hooks 		= require('./services/hooks')
	  , cryptoUtils = require("./utils/cryptoUtils")
		, { mineBlock }	= require('./services/block')
		, _ 		= require('lodash') ;

dotenv.config();

async.waterfall([
	cb => mongo.init(cb),
	cb => server.init(cb),
	cb => hooks.init(cb),
	cb => cryptoUtils.validateCryptoMons(cb),
	cb => {
		setInterval(() => {
			mineBlock(_.noop)
		}, 20000);
		cb();
	}
]);
