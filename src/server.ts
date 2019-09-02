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
app.use('/api', routes.api);

//TODO: Ver tipo de cb
export function init(cb: () => void) {
    let server = app.listen(process.env.PORT || 8000, () => {
        let host = server.address().address;
        let port = server.address().port;
        debug('Listening on port %s', port);
        app.use('/api', logger('mine'));
        cb();
    })
}