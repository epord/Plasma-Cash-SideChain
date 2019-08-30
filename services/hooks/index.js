const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL));
const CryptoMonsJson = require("./CryptoMons.json");
const RootChainJson = require("./RootChain.json");
const BigNumber = require("bignumber.js");
const _ = require('lodash');
const { depositBlock }	= require('../block');
const { exitSlot, getOwner, resetSlot }	= require('../coinState');
const { debug }	= require('debug')('app:api:hooks')


const subscribeLogEvent = (contract, iface, cb) => {
	const subscription = web3.eth.subscribe('logs', {
	  address: contract.options.address,
	  topics: [iface.signature]
	}, cb);

	debug("Subscribed to event " + iface.name);
	return subscription;
};

const getEventInterface = (contract, eventName) => {
	return _.find(
	  contract.jsonInterface.abi.events,
	  o => o.name === eventName,
	)
};

const eventToObj = (iface, result) => {
	return web3.eth.abi.decodeLog(
		iface.abiItem.inputs,
		result.data == "0x" || (new BigNumber(result.data)).isZero() ? undefined : result.data,
		result.topics.slice(1)
	);
};

const onDebug = (iDebug) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iDebug, result);
	debug(`Debug: ${eventObj.message}`)
};

const onDeposit = (iDeposit) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iDeposit, result);
	debug(`Deposit: `, eventObj);

	const { slot, blockNumber, from } = eventObj;
	if (slot == undefined || !from || blockNumber == undefined) {
		return console.error('Missing parameter');
	}

	const slotBN = new BigNumber(slot.toString());
	if(slotBN.isNaN()) {
		return console.error('Invalid slot');
	}

	const blockNumberBN = new BigNumber(blockNumber.toString());
	if(blockNumberBN.isNaN()) {
		return console.error('Invalid blockNumber');
	}

	depositBlock(slotBN, blockNumberBN, from, (err) => { console.error(err); });
};

const onExitStarted = (iExitStarted) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iExitStarted, result)
	debug(`Exit: `,eventObj);

	getOwner(eventObj.slot, (err, owner) => {
		if(err) console.error(err);
		if(owner.toLowerCase() != eventObj.owner.toLowerCase()) {
			debug(`ERROR: An impostor is trying to Exiting the slot ${eventObj.slot}`)
		}

		//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
		exitSlot(eventObj.slot, err => { if (err) console.error(err) });
	});
};

const onFinalizedExit = (iFinalizedExit) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iFinalizedExit, result);
	debug(`FinalizedExit: `, eventObj);
};

const onTransfer = (iTransfer) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iTransfer, result);
	console.log(`New Transfer!`, eventObj)
};

const onChallengedExit = (iChallengedExit) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iChallengedExit, result);

	//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
	debug(`New Challenger approaches! ${eventObj.slot} at block ${eventObj.challengingBlockNumber}`)
};

const onRespondedExitChallenge = (iRespondedExitChallenge) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iRespondedExitChallenge, result);
	debug(`Challenged responded ${eventObj.slot}`)
};

const onCoinReset = (iCoinReset) => (error, result) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iCoinReset, result);
	debug(`Coin reset ${eventObj.slot} for ${eventObj.owner}`);

	resetSlot(eventObj.slot, (err, coinState) => {
		if (err) return console.error(err);
		//TODO what to do here?
		if(coinState.owner.toLowerCase() != eventObj.owner.toLowerCase()) {
			debug("ERROR!: Owner on the coinReset does not match owner on the DB");
		}
	});
};

const init = (cb) => {
	//RootChain
	const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);

	const iDebug = getEventInterface(RootChainContract, 'Debug');
	subscribeLogEvent(RootChainContract, iDebug, onDebug(iDebug));

	const iDeposit = getEventInterface(RootChainContract, 'Deposit');
	subscribeLogEvent(RootChainContract, iDeposit, onDeposit(iDeposit));

	const iExitStarted = getEventInterface(RootChainContract, 'StartedExit');
	subscribeLogEvent(RootChainContract, iExitStarted, onExitStarted(iExitStarted));

	const iFinalizedExit = getEventInterface(RootChainContract, 'FinalizedExit');
	subscribeLogEvent(RootChainContract, iFinalizedExit, onFinalizedExit(iFinalizedExit));

	const iChallengedExit = getEventInterface(RootChainContract, 'ChallengedExit');
	subscribeLogEvent(RootChainContract, iChallengedExit, onChallengedExit(iChallengedExit));

	const iRespondedExitChallenge = getEventInterface(RootChainContract, 'RespondedExitChallenge');
	subscribeLogEvent(RootChainContract, iRespondedExitChallenge, onRespondedExitChallenge(iChallengedExit));

	const iCoinReset = getEventInterface(RootChainContract, 'CoinReset');
	subscribeLogEvent(RootChainContract, iCoinReset, onCoinReset(iCoinReset));

	//CryptoMon
	const CryptoMonContract = new web3.eth.Contract(CryptoMonsJson.abi,CryptoMonsJson.networks["5777"].address);

	const iTransfer = getEventInterface(CryptoMonContract, 'Transfer');
	subscribeLogEvent(CryptoMonContract, iTransfer, onTransfer(iTransfer));

	cb();
};

module.exports = {
	init
};