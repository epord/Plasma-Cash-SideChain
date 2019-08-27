const express = require('express')
		, router = express.Router({ mergeParams: true })
		, debug = require('debug')('app:api');

debug('registering /api routes');

router.use((req, res, next) => {
	debug(`${req.method} ${req.baseUrl}${req.path} %o %o`, req.query || {}, req.body || {});
	next();
});

router.use('/blocks', require('./blocks'));
router.use('/contracts', require('./contracts'));
router.use('/transactions', require('./transactions'));
router.use('/tokens', require('./tokens'));
router.use('/challenges', require('./challenges'));
router.use('/exit', require('./exit'));

module.exports = router;