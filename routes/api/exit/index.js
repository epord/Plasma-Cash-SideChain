const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:exit')
	, Status 					= require('http-status-codes')
	, BigNumber       			= require('bignumber.js')
	, { getExitData } = require('../../../services/exit');

debug('registering /api/exit routes')

const responseWithStatus = (res) => (err, status) => {
	if (err && !err.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json(err);
	if (err && err.statusCode) return res.status(err.statusCode).json(err.message);
	if (!status.statusCode) return res.status(Status.INTERNAL_SERVER_ERROR).json("No message");
	return res.status(status.statusCode).json(status.message)
};

router.get('/data/:slot([A-Fa-f0-9]+)', (req, res, next) => {
	const { slot } = req.params;

	if (!slot) {
		return res.status(Status.BAD_REQUEST).json('Missing parameter');
	}

	const slotBN = new BigNumber(slot);
	if(slotBN.isNaN()) {
		return res.status(Status.BAD_REQUEST).json('Invalid slot');
	}

	getExitData(slot, responseWithStatus(res));

});

router.get('/singleData/:slot([0-9a-zA-z]+)', (req, res, next) => {
	const { slot } = req.params;

	TransactionService.findById(slot).exec((err, t) => {
		if(err) return responseWithStatus(res)(err);
		if(!t)  return responseWithStatus(res)({ statusCode: 404, message: 'Transaction not found'});
		if(!t.mined_block) return responseWithStatus(res)({ statusCode: Status.CONFLICT, message: 'Transaction not yet mined'});


		let exitingBytes = getTransactionBytes(t.slot, t.block_spent, new BigNumber(1), t.recipient);

		const exitData = {
			slot: t.slot,
			bytes: exitingBytes,
			hash: t.hash,
			proof: sparseMerkleTree.createMerkleProof(t.slot.toFixed()),
			signature: t.signature,
			block: t.mined_block
		};

		return responseWithStatus(res)(null, {statusCode: 200, message: exitData})
	});
});


module.exports = router;