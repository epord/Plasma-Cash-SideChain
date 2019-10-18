const express 					= require('express')
	, router 					= express.Router({ mergeParams: true })
	, debug 					= require('debug')('app:api:exit')
	, Status 					= require('http-status-codes')
	, BigNumber       			= require('bignumber.js')
	, { getExitData } = require('../../../services/exits')
	, CryptoMonsJson = require("../../../json/CryptoMons.json")
	, RootChainJson = require("../../../json/RootChain.json")
	, ValidatorManagerContractJson = require('../../../json/ValidatorManagerContract.json')
	, PlasmaChannelManagerJson = require('../../../json/PlasmaCM.json')
	, PlasmaTurnGameJson = require('../../../json/RPSExample.json')

debug('registering /api/contracts routes')

router.get('/', (req, res, next) => {

	if (!CryptoMonsJson || !RootChainJson) {
		return res.status(Status.INTERNAL_SERVER_ERROR).json('Contracts do not exist');
	}

	return res.status(Status.OK).json({
		RootChain: {
			abi: RootChainJson.abi,
			networks: RootChainJson.networks,
		},
		CryptoMons: {
			abi: CryptoMonsJson.abi,
			networks: CryptoMonsJson.networks,
		},
		ValidatorManagerContract: {
			abi: ValidatorManagerContractJson.abi,
			networks: ValidatorManagerContractJson.networks,
		},
		PlasmaCMContract: {
			abi: PlasmaChannelManagerJson.abi,
			networks: PlasmaChannelManagerJson.networks,
		},
		PlasmaTurnGameContract: {
			abi: PlasmaTurnGameJson.abi,
			networks: PlasmaTurnGameJson.networks,
		}
	});

});


module.exports = router;