const express 			= require('express')
, router 						= express.Router({ mergeParams: true })
, debug 						= require('debug')('app:api:blocks')
, Status 						= require('http-status-codes')
, async							= require('async')
, { BlockService } 	= require('../../../services')
, { mineBlock } 		= require('../../../services/block')

debug('registering /api/blocks routes')

router.get('/:id([A-Fa-f0-9]+)', (req, res, next) => {
	res.send(`Block id: ${req.params.id}`);
});

router.get('/', (req, res, next) => {
	BlockService
		.find({})
		.exec((err, blocks) => {
			if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
			res.status(Status.OK).json(blocks);
		})
})

router.post('/create', (req, res, next) => {
	mineBlock('0x71fb09a7e9dc4fd2a85797bc92080d49ead60ebaa2b562d817bdfb31bc258134', (err) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		res.status(Status.OK).json('ok');
	});
})

router.post('/mine', (req, res, next) => {
	mineBlock((err) => {
		if (err) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
		res.status(Status.OK).json('ok');
	});
})

module.exports = router;