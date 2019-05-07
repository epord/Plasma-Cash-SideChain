const express 	= require('express')
		, app 			= express()
		, bodyParser	= require('body-parser')
		, compression				= require('compression')
		, debug 		= require('debug')('app:server')
		, moment 		= require('moment')
		, logger		= require('morgan')
		, routes 		= require('./routes');

debug('setting up server')

logger.format('mine', (tokens, req, res) => {const sock = req.socket;
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
})

app.use(compression());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use('/api', logger('mine'));
app.use('/api', routes.api);

const init = (cb) => {
	var server = app.listen(process.env.PORT || 8000, () => {
		var host = server.address().address
		var port = server.address().port
		debug('Listening on port %s', port)
		cb();
	})

}

module.exports = {
	init,
	app
};