const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL));
const CryptoMonsJson = require("../../json/CryptoMons.json");
const RootChainJson = require("../../json/RootChain.json");
import { BigNumber } from 'bignumber.js';
import BN from 'bn.js';

const _ = require('lodash');
const { depositBlock }	= require('../block');
const { exitSlot, getOwner, resetSlot }	= require('../coinState');
const debug	= require('debug')('app:api:hooks')
const { getLastMinedTransaction } = require('../transaction');
const { TransactionService } = require('../index');

interface abiInterface {
	abiItem: {
		inputs: any;
	}
};

interface eventResultInterface {
	data: string;
	topics: Array<any>
}

type genericCB = ((err: any, result?: any) => void)

const subscribeLogEvent = (contract: { options: { address: any; }; }, iface: { signature: any; name: string; }, cb: { (error: any, result: eventResultInterface): void; }) => {
	const subscription = web3.eth.subscribe('logs', {
	  address: contract.options.address,
	  topics: [iface.signature]
	}, cb);

	debug("Subscribed to event " + iface.name);
	return subscription;
};

const getEventInterface = (contract: { jsonInterface: { abi: { events: any; }; }; }, eventName: string) => {
	return _.find(
	  contract.jsonInterface.abi.events,
        (o: { name: string; }) => o.name === eventName,
	)
};

const eventToObj = (iface: abiInterface, result: eventResultInterface) => {
	return web3.eth.abi.decodeLog(
		iface.abiItem.inputs,
		result.data == "0x" || (new BigNumber(result.data)).isZero() ? undefined : result.data,
		result.topics.slice(1)
	);
};

const onDebug = (iDebug: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iDebug, result);
	debug(`Debug: ${eventObj.message}`)
};

const onDeposit = (iDeposit: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iDeposit, result);
	debug(`Deposit: `, eventObj);

	const { slot, blockNumber, from } = eventObj;

	const slotBN = new BigNumber(slot.toString());
	const blockNumberBN = new BigNumber(blockNumber.toString());

	depositBlock(slotBN, blockNumberBN, from, (err: any) => { console.error(err); });
};

const onExitStarted = (iExitStarted: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iExitStarted, result)
	debug(`Exit: `,eventObj);

	getOwner(eventObj.slot.toString(), (err: any, owner: { toLowerCase: () => void; }) => {
		if(err) console.error(err);
		if(owner.toLowerCase() != eventObj.owner.toLowerCase()) {
			debug(`ERROR: An impostor is trying to Exiting the slot ${eventObj.slot.toString()}`)
			const slotBN = new BigNumber(eventObj.slot.toString());

			getExit(slotBN, (err: any, exitData: any) => {
				if (err) return console.error(err)
				const { prevBlock, exitBlock } = exitData;

				const exitBlockBN = new BigNumber(exitBlock);
				const prevBlockBN = new BigNumber(prevBlock);

				TransactionService.findOne({
					slot: slotBN,
					block_spent: exitBlockBN,
				}, (err: any, transaction: any) => { /// TODO: transaction type
					if (err) return console.error(err);
					if (transaction) {
						// Challenge after
						console.log("challenge after");
					} else {
						TransactionService.findOne({
							slot: slotBN,
							block_spent: prevBlockBN,
						}, (err: any, transaction: any) => { /// TODO: transaction type
							if (err) return console.error(err);
							if (transaction) {
								// Challenge Between
								console.log("challenge between");
							} else {
								getLastMinedTransaction({ slot: slotBN, block_spent: { $lte: prevBlockBN } }, (err: any, transaction: any) => {/// TODO: transaction type
									if (err) return console.error(err);
									if (!transaction) return console.error("Corrupted database. Mass exit INMINENT!!")
									// Challenge Before
									console.log("challenge before");
								})
							}
						})
					}
				})
			})
		}

		//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
		exitSlot(eventObj.slot.toString(), (err: any) => { if (err) console.error(err) });
	});
};

const onFinalizedExit = (iFinalizedExit: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iFinalizedExit, result);
	debug(`FinalizedExit: `, eventObj);
};

const onTransfer = (iTransfer: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iTransfer, result);
	console.log(`New Transfer!`, eventObj)
};

const onChallengedExit = (iChallengedExit: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iChallengedExit, result);

	//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
	debug(`New Challenger approaches! ${eventObj.slot.toString()} at block ${eventObj.challengingBlockNumber}`)
};

const onRespondedExitChallenge = (iRespondedExitChallenge: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iRespondedExitChallenge, result);
	debug(`Challenged responded ${eventObj.slot.toString()}`)
};

const onCoinReset = (iCoinReset: abiInterface) => (error: any, result: eventResultInterface) => {
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

const getExit = (slot: BigNumber, cb: genericCB) => {
	const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);
	web3.eth.getAccounts().then((accounts: any) => {
		if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
		RootChainContract.methods.getExit(slot.toFixed()).call({from: accounts[0]}, (err: any, res: any) => {
			if (err) return cb(err);
			const exitData = {
				prevBlock: res[1].toString(),
				exitBlock: res[2].toString()
			};
			cb(null, exitData);
		});
	});
}

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