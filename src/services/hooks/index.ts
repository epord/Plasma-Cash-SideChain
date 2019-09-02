const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL));
const CryptoMonsJson = require("./CryptoMons.json");
const RootChainJson = require("./RootChain.json");
const BigNumber = require("bignumber.js");
const _ = require('lodash');
const { depositBlock }	= require('../block');
const { exitSlot, getOwner, resetSlot }	= require('../coinState');
const debug	= require('debug')('app:api:hooks')

//TODO: Ver bien los tipos
const subscribeLogEvent = (contract: { options: { address: any; }; }, iface: { signature: any; name: string; }, cb: { (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; }) => {
	const subscription = web3.eth.subscribe('logs', {
	  address: contract.options.address,
	  topics: [iface.signature]
	}, cb);

	debug("Subscribed to event " + iface.name);
	return subscription;
};

//TODO: Ver bien los tipos
const getEventInterface = (contract: { jsonInterface: { abi: { events: any; }; }; }, eventName: string) => {
	return _.find(
	  contract.jsonInterface.abi.events,
        (o: { name: string; }) => o.name === eventName,
	)
};

//TODO: Ver bien los tipos
const eventToObj = (iface: { abiItem: { inputs: any; }; }, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	return web3.eth.abi.decodeLog(
		iface.abiItem.inputs,
		result.data == "0x" || (new BigNumber(result.data)).isZero() ? undefined : result.data,
		result.topics.slice(1)
	);
};

//TODO: Ver bien los tipos
const onDebug = (iDebug: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iDebug, result);
	debug(`Debug: ${eventObj.message}`)
};

//TODO: Ver bien los tipos
const onDeposit = (iDeposit: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
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

	depositBlock(slotBN, blockNumberBN, from, (err: any) => { console.error(err); });
};

//TODO: Ver bien los tipos
const onExitStarted = (iExitStarted: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iExitStarted, result)
	debug(`Exit: `,eventObj);

	getOwner(eventObj.slot.toString(), (err: any, owner: { toLowerCase: () => void; }) => {
		if(err) console.error(err);
		if(owner.toLowerCase() != eventObj.owner.toLowerCase()) {
			debug(`ERROR: An impostor is trying to Exiting the slot ${eventObj.slot.toString()}`)
		}

		//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
		exitSlot(eventObj.slot.toString(), (err: any) => { if (err) console.error(err) });
	});
};

//TODO: Ver bien los tipos
const onFinalizedExit = (iFinalizedExit: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iFinalizedExit, result);
	debug(`FinalizedExit: `, eventObj);
};

const onTransfer = (iTransfer: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iTransfer, result);
	console.log(`New Transfer!`, eventObj)
};

//TODO: Ver bien los tipos
const onChallengedExit = (iChallengedExit: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iChallengedExit, result);

	//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
	debug(`New Challenger approaches! ${eventObj.slot.toString()} at block ${eventObj.challengingBlockNumber}`)
};

//TODO: Ver bien los tipos
const onRespondedExitChallenge = (iRespondedExitChallenge: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iRespondedExitChallenge, result);
	debug(`Challenged responded ${eventObj.slot.toString()}`)
};

//TODO: Ver bien los tipos
const onCoinReset = (iCoinReset: { abiItem: { inputs: any; }; }) => (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iCoinReset, result);
	debug(`Coin reset ${eventObj.slot.toString()} for ${eventObj.owner}`);

	resetSlot(eventObj.slot.toString(), (err: any, coinState: { owner: { toLowerCase: () => void; }; }) => {
		if (err) return console.error(err);
		//TODO what to do here?
		if(coinState.owner.toLowerCase() != eventObj.owner.toLowerCase()) {
			debug("ERROR!: Owner on the coinReset does not match owner on the DB");
		}
	});
};

export function init(cb: () => void) {
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
}