const dotenv 		= require('dotenv')
		, async 		= require('async')
		, mongo 		= require('./mongo')
		, server 		= require('./server')
		, hooks 		= require('./services/hooks')

dotenv.config();

async.waterfall([
	cb => mongo.init(cb),
	cb => server.init(cb),
	cb => hooks.init(cb)
]);
