const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL));
const CryptoMonsJson = require("../../json/CryptoMons.json");
const RootChainJson = require("../../json/RootChain.json");
import { BigNumber } from 'bignumber.js';
import BN from 'bn.js';

const _ = require('lodash');
const { depositBlock }	= require('../../services/block.js');
const { exitSlot, getOwner, resetSlot }	= require('../coinState');
const debug	= require('debug')('app:api:hooks')
const { getLastMinedTransaction } = require('../../services/transaction.js');
const { TransactionService } = require('../index');
const { getChallengeAfterData, getChallengeBeforeData } = require("../challenges");

const async = require('async');

interface abiInterface {
	abiItem: {
		inputs: any;
	}
};

interface eventResultInterface {
	data: string;
	topics: Array<any>
}

interface exitData {
	hash: string,
	slot: BigNumber,
	challengingBlockNumber: BigNumber,
	challengingTransaction: string,
	proof: string,
	signature: string
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

const onWithdrew = (iWithdrew: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iWithdrew, result);
	debug(`Withdrew: ${eventObj.message}`)
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

//TODO: refactor this function to make it more readable
const onExitStarted = (iExitStarted: abiInterface) => (error: any, result: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iExitStarted, result)
	const slotBN = new BigNumber(eventObj.slot.toString());
	debug(`Exit: `,eventObj);

	exitSlot(eventObj.slot.toString(), (err: any) => { if (err) console.error(err) });

	async.waterfall([
		(next: any) => {
			getOwner(eventObj.slot.toString(), next)
		},
		(owner: string, next: any) => {
			const isExitCorrect = owner.toLowerCase() == eventObj.owner.toLowerCase();
			const autoChallengeEnabled = process.env.AUTO_CHALLENGE != 'false';
			if (isExitCorrect || !autoChallengeEnabled) return; // Nothing to do here

			debug(`An impostor is trying to Exiting the slot ${eventObj.slot.toString()}!`);
			getExit(slotBN, next);
		},
		(exitData: any, next: any) => {
			// Challenge after
			const { exitBlock } = exitData;
			const exitBlockBN = new BigNumber(exitBlock);

			TransactionService.findOne({
				slot: slotBN,
				block_spent: exitBlockBN,
			}, (err: any, transaction: any) => {
				if (err || !transaction) return next(err, exitData); // Not a challenge after

				debug("Challenging after...");
				async.waterfall([
					(next: any) => getChallengeAfterData(slotBN, exitBlockBN, (err: any, status: any) => {
						next(err, status.message)
					}),
					(exitData: exitData, next: any) => {
						challengeAfter(exitData.slot, exitData.challengingBlockNumber, exitData.challengingTransaction, exitData.proof, exitData.signature, next);
					}
				], (err: any) => {
					if (err) return console.error(err);
					debug('Successfully challenged after');
					resetSlot(eventObj.slot.toString(), (err: any) => { if (err) console.error(err) });
				});
				return; // do not continue waterfall
			});
		},
		(exitData: any, next: any) => {
			// Challenge between
			const { prevBlock } = exitData;
			const prevBlockBN = new BigNumber(prevBlock);

			TransactionService.findOne({
				slot: slotBN,
				block_spent: prevBlockBN,
			}, (err: any, transaction: any) => {
				if (err || !transaction) return next(err, exitData); // Not a challenge between

				debug("Challenging between...");
				async.waterfall([
					(next: any) => getChallengeAfterData(slotBN, prevBlockBN, (err: any, status: any) => {
						next(err, status.message)
					}),
					(exitData: exitData, next: any) => {
						challengeBetween(exitData.slot, exitData.challengingBlockNumber, exitData.challengingTransaction, exitData.proof, exitData.signature, next);
					}
				], (err: any) => {
					if (err) return console.error(err);
					debug('Successfully challenged between');
					resetSlot(eventObj.slot.toString(), (err: any) => { if (err) console.error(err) });
				})
				return; // do not continue waterfall
			});
		},
		(exitData: any, next: any) => {
			// Challenge before
			const { prevBlock } = exitData;
			const prevBlockBN = new BigNumber(prevBlock);

			debug("Challenging before...");
			async.waterfall([
				(next: any) => getChallengeBeforeData(slotBN, prevBlockBN, (err: any, status: any) => {
					next(err, status.message)
				}),
				(exitData: exitData, next: any) => {
					challengeBefore(exitData.slot, exitData.challengingTransaction, exitData.proof, exitData.challengingBlockNumber, next);
				}
			], (err: any) => {
				if (err) return console.error(err);
				console.log('Successfully challenged before');
			});
		}
	], console.error);
}

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

const challengeAfter = (slot: BigNumber, challengingBlockNumber: BigNumber, challengingTransaction: string, proof: string, signature: string, cb: genericCB) => {
	web3.eth.getAccounts().then((accounts: any) => {
		if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
		const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);

		RootChainContract.methods.challengeAfter(
			slot.toFixed(),
			challengingTransaction,
			proof,
			signature,
			challengingBlockNumber.toFixed(),
		).send({
				from: accounts[0],
				gas: 1500000
			}, cb);
	});
}

const challengeBetween = (slot: BigNumber, challengingBlockNumber: BigNumber, challengingTransaction: string, proof: string, signature: string, cb: genericCB) => {
	web3.eth.getAccounts().then((accounts: any) => {
		if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
		const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);
		RootChainContract.methods.challengeBetween(
			slot.toFixed(),
			challengingTransaction,
			proof,
			signature,
			challengingBlockNumber.toFixed()
		).send({
			from: accounts[0],
			gas: 1500000
		}, cb);
	});
}

const challengeBefore = (slot: BigNumber, txBytes: string, txInclusionProof: string, blockNumber: BigNumber, cb: genericCB) => {
	web3.eth.getAccounts().then((accounts: any) => {
		if (!accounts || accounts.length == 0) return cb('Cannot find accounts');
		const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);

		RootChainContract.methods.challengeBefore(
			slot.toFixed(),
			txBytes,
			txInclusionProof,
			blockNumber.toFixed()
		).send({
			from: accounts[0],
			value: web3.utils.toWei('0.1', 'ether'),
			gas: 1500000
		}, cb);
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
	subscribeLogEvent(RootChainContract, iRespondedExitChallenge, onRespondedExitChallenge(iRespondedExitChallenge));

	const iCoinReset = getEventInterface(RootChainContract, 'CoinReset');
	subscribeLogEvent(RootChainContract, iCoinReset, onCoinReset(iCoinReset));

	const iWithdrew = getEventInterface(RootChainContract, 'Withdrew');
	subscribeLogEvent(RootChainContract, iCoinReset, onWithdrew(iWithdrew));

	//CryptoMon
	const CryptoMonContract = new web3.eth.Contract(CryptoMonsJson.abi,CryptoMonsJson.networks["5777"].address);

	const iTransfer = getEventInterface(CryptoMonContract, 'Transfer');
	subscribeLogEvent(CryptoMonContract, iTransfer, onTransfer(iTransfer));

	cb();
}