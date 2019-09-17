let express 	= require('express')
		, app 			= express()
		, bodyParser	= require('body-parser')
		, compression				= require('compression')
		, debug 		= require('debug')('app:server')
		, moment 		= require('moment')
		, logger		= require('morgan')
		, routes 		= require('./routes');

debug('setting up server');

//TODO: Ver tipos de tokens, res y req
logger.format('mine', (tokens: any, req: { socket: any; ip: any; method: any; originalUrl: any; _startTime: number; }, res: { statusCode: any; }) => {const sock = req.socket;
	const color = (s => {
		if (s >= 500) return 31;
		if (s >= 400) return 33;
		if (s >= 300) return 36;
		return 32;
	})(res.statusCode);
	const ip = (() => {
		if (req.ip) return req.ip;
		if (sock.socket) return sock.socket.remoteAddress;
		return sock.remoteAddress;
	})();
	return `[\u001b[90m${moment().format('DD/MM/YYYY HH:mm,SSS')}\u001b[37m] ${ip} - \u001b[90m${req.method} ${req.originalUrl} \u001b[${color}m${res.statusCode} \u001b[90m${Date.now() - req._startTime}ms\u001b[0m`;
});

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(function (req: any, res: { setHeader: { (arg0: string, arg1: string): void; (arg0: string, arg1: string): void; (arg0: string, arg1: string): void; (arg0: string, arg1: boolean): void; }; }, next: () => void) {
	// Website you wish to allow to connect
	res.setHeader('Access-Control-Allow-Origin', '*');
	// Request methods you wish to allow
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
	// Request headers you wish to allow
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
	// Set to true if you need the website to include cookies in the requests sent
	// to the API (e.g. in case you use sessions)
	res.setHeader('Access-Control-Allow-Credentials', true);
	// Pass to next layer of middleware
	next();
});
app.use('/api', routes.api);

export function init(cb: () => void) {
    let server = app.listen(process.env.PORT || 8000, () => {
        let host = server.address().address;
        let port = server.address().port;
        debug('Listening on port %s', port);
        app.use('/api', logger('mine'));
        cb();
    })
}

module.exports.app = app