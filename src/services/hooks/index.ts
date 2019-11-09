import {depositBlock} from "../block";
import {BigNumber} from 'bignumber.js';
import {CallBack, ChallengeData} from "../../utils/TypeDef";
import {CoinState} from "../coinState";
import {fromBytes, fromBytesAndData} from "../../utils/CryptoMonBattles";
import {ICoinState} from "../../models/coinStateModel";
import {IBattle, ICMBState} from "../../models/battle";
import {Challenge} from "../challenges";
import {Battle} from "../battle";

const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL));
const CryptoMonsJson = require("../../json/CryptoMons.json");
const RootChainJson = require("../../json/RootChain.json");
const PlasmaChannelManagerJson = require('../../json/PlasmaCM.json');

const _ = require('lodash');
const debug	= require('debug')('app:api:hooks');
const { TransactionService } = require('..');

const { BattleService } = require('..');

const async = require('async');

interface abiInterface {
	abiItem: {
		inputs: any;
	}
}

interface eventResultInterface {
	data: string;
	topics: Array<any>
}

interface ExitingBlocks {
	prevBlock: string,
	exitBlock: string
}

const subscribeLogEvent = (contract: { options: { address: any; }; },
						   iface: { signature: string; name: string; },
						   cb: CallBack<eventResultInterface>) => {

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

const onWithdrew = (iWithdrew: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iWithdrew, result!);
	debug(`Withdrew: ${eventObj.message}`)
};

const onDeposit = (iDeposit: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iDeposit, result!);
	debug(`Deposit: `, eventObj);

	const { slot, blockNumber, from } = eventObj;

	// TODO: See the type of slot, maybe we can send it like it is
	depositBlock(new BigNumber(slot.toString()), new BigNumber(blockNumber.toString()), from, (err: any) => { console.error(err); });
};

const onExitStarted = (iExitStarted: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);

	const eventObj = eventToObj(iExitStarted, result!);
	const slotBN = new BigNumber(eventObj.slot.toString());
	debug(`Exit: `,eventObj);

	CoinState.exitSlot(slotBN, (err: any) => { if (err) console.error(err) });

	async.waterfall([
		(next: CallBack<string>) => { CoinState.getOwner(eventObj.slot.toString(), next) },
		(owner: string, next: CallBack<ExitingBlocks>) => {
			const isExitCorrect = owner.toLowerCase() == eventObj.owner.toLowerCase();
			const autoChallengeEnabled = process.env.AUTO_CHALLENGE != 'false';
			if (isExitCorrect || !autoChallengeEnabled) return; // Nothing to do here

			debug(`An impostor is trying to Exiting the slot ${eventObj.slot.toString()}!`);
			getExit(slotBN, next);
		},
		(exitingBlocks: ExitingBlocks, next: CallBack<ExitingBlocks>) => tryChallengeAfter(slotBN, exitingBlocks, next),
		(exitingBlocks: ExitingBlocks, next: CallBack<ExitingBlocks>) => tryChallengeBetween(slotBN, exitingBlocks, next),
		(exitingBlocks: ExitingBlocks, next: CallBack<ExitingBlocks>) => tryChallengeBefore(slotBN, exitingBlocks, next),
	], console.error);
};

const tryChallengeAfter = (slotBN: BigNumber, exitingBlocks: ExitingBlocks, next: CallBack<any>) => {
	// Challenge after
	const { exitBlock } = exitingBlocks;
	const exitBlockBN = new BigNumber(exitBlock);

	TransactionService.findOne( {slot: slotBN, block_spent: exitBlockBN}, (err: any, transaction: any) => {
		if (err || !transaction) return next(err, exitingBlocks); // Not a challenge after

		debug("Challenging after...");
		async.waterfall([
			(next: any) => Challenge.getAfterData(slotBN, exitBlockBN, (err: any, status: any) => next(err, status.message)),
			(challengeData: ChallengeData, next: any) => {

				challengeAfter(
					slotBN,
					challengeData.challengingBlockNumber,
					challengeData.challengingTransaction,
					challengeData.proof,
					challengeData.signature,
					next);
			}

		], (err: any) => {
			if (err) return console.error(err);
			debug('Successfully challenged after');
			CoinState.resetSlot(slotBN, (err: any) => { if (err) console.error(err) });
		});
		return; // do not continue waterfall
	});
};

const challengeAfter = (slot: BigNumber, challengingBlockNumber: BigNumber, challengingTransaction: string, proof: string, signature: string, cb: CallBack<string>) => {
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
};

const tryChallengeBetween =  (slotBN: BigNumber, exitingBlocks: ExitingBlocks, next: CallBack<any>) => {
	// Challenge between
	const { prevBlock } = exitingBlocks;
	const prevBlockBN = new BigNumber(prevBlock);

	TransactionService.findOne({
		slot: slotBN,
		block_spent: prevBlockBN,
	}, (err: any, transaction: any) => {
		if (err || !transaction) return next(err, exitingBlocks); // Not a challenge between

		debug("Challenging between...");
		async.waterfall([
			(next: any) => Challenge.getAfterData(slotBN, prevBlockBN, (err: any, status: any) => next(err, status.message)),

			(challengeData: ChallengeData, next: any) => {
				challengeBetween(
					slotBN,
					challengeData.challengingBlockNumber,
					challengeData.challengingTransaction,
					challengeData.proof,
					challengeData.signature,
					next);
			}
		], (err: any) => {
			if (err) return console.error(err);
			debug('Successfully challenged between');
			CoinState.resetSlot(slotBN, (err: any) => { if (err) console.error(err) });
		});
		return; // do not continue waterfall
	});
};

const challengeBetween = (slot: BigNumber, challengingBlockNumber: BigNumber, challengingTransaction: string, proof: string, signature: string, cb: CallBack<string>) => {
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
};

const tryChallengeBefore =  (slotBN: BigNumber, exitingBlocks: ExitingBlocks, next: CallBack<any>) => {
	// Challenge before
	const { prevBlock } = exitingBlocks;
	const prevBlockBN = new BigNumber(prevBlock);

	debug("Challenging before...");
	async.waterfall([
		(next: any) => Challenge.getBeforeData(slotBN, prevBlockBN, (err: any, status: any) => next(err, status.message) ),
		(exitData: ChallengeData, next: any) => {
			challengeBefore(
				slotBN,
				exitData.challengingTransaction,
				exitData.proof,
				exitData.challengingBlockNumber,
				next);
		}
	], (err: any) => {
		if (err) return console.error(err);
		console.log('Successfully challenged before');
	});
};

const challengeBefore = (slot: BigNumber, txBytes: string, txInclusionProof: string, blockNumber: BigNumber, cb: CallBack<string>) => {
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
};

const onFinalizedExit = (iFinalizedExit: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iFinalizedExit, result!);
	debug(`FinalizedExit: `, eventObj);
};

const onTransfer = (iTransfer: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iTransfer, result!);
	console.log(`New Transfer!`, eventObj)
};

const onChallengedExit = (iChallengedExit: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iChallengedExit, result!);

	//TODO Challenge automatically - Add a flag en .env to automatically challenge stuff
	debug(`New Challenger approaches! ${eventObj.slot.toString()} at block ${eventObj.challengingBlockNumber}`)
};

const onRespondedExitChallenge = (iRespondedExitChallenge: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iRespondedExitChallenge, result!);
	debug(`Challenged responded ${eventObj.slot.toString()}`)
};

const onCoinReset = (iCoinReset: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iCoinReset, result!);
	debug(`Coin reset ${eventObj.slot.toString()} for ${eventObj.owner}`);

	CoinState.resetSlot(new BigNumber(eventObj.slot.toString()), (err: any, coinState: ICoinState) => {
		if (err) return console.error(err);
		//TODO what to do here?
		if(coinState.owner.toLowerCase() != eventObj.owner.toLowerCase()) {
			debug("ERROR!: Owner on the coinReset does not match owner on the DB");
		}
	});
};

const onChannelFunded = (iChannelFunded: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iChannelFunded, result!);
	debug(`Channel ${eventObj.channelId} has been funded`);
	fromBytes(eventObj.initialState, (err: any, initialState?: ICMBState) => {
		if (err) return console.error(err);
		if (!initialState) return console.error('Couldn\'t decode initialState bytes');
		Battle.create(
			eventObj.channelId.toString(),
			eventObj.channelType,
			eventObj.creator,
			eventObj.opponent,
			initialState,
		(err: any) => { if(err) debug("ERROR: " + err) });
	});
};


const onChannelConcluded = (iChannelEnd: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iChannelEnd, result!);
	debug(`Channel ${eventObj.channelId} has concluded`);
	Battle.conclude(eventObj.channelId, (err: any) => console.error("Error concluding battle", err));
};


const onForceMoveResponded = (iForceMoveResponded: abiInterface) => (error: any, result?: eventResultInterface) => {
	if(error) return console.error(error);
	const eventObj = eventToObj(iForceMoveResponded, result!);
	debug(`Force move responded in channel ${eventObj.channelId} with ${eventObj.nextState}`);
	BattleService.findById(eventObj.channelId, (err: any, battle: IBattle) => {
		if (err) return console.error("Error finding battle", err);
		const nextState = {
			channelId: eventObj.channelId.toString(),
			channelType: eventObj.nextState.channelType,
			participants: eventObj.nextState.participants,
			turnNum: parseInt(eventObj.nextState.turnNum.toString()),
			game: fromBytesAndData(eventObj.nextState.gameAttributes,
				battle.state.game.cryptoMonPLInstance,
				battle.state.game.cryptoMonOPInstance,
				battle.state.game.cryptoMonPLData,
				battle.state.game.cryptoMonOPData),
			signature: eventObj.signature,
		};
		Battle.play(nextState, battle, (err: any) => console.error("Force move responded error", err));
	});
};

const getExit = (slot: BigNumber, cb: CallBack<any>) => {
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
};

export function init(cb: () => void) {
	//RootChain
	const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);

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

	//CryptoMons Battles TODO: Listen to unlawful battles
	// const CryptoMonsBattlesContract = new web3.eth.Contract(CryptoMonsBattlesJson.abi, CryptoMonsBattlesJson.networks["5777"].address);
	// const CryptoMonsBattlesaddress = CryptoMonsBattlesJson.networks["5777"].address;

	// const iCryptoMonBattleStarted = getEventInterface(CryptoMonsBattlesContract, 'CryptoMonBattleStarted');
	// subscribeLogEvent(CryptoMonsBattlesContract, iCryptoMonBattleStarted, onBattleStarted(CryptoMonsBattlesContract, iCryptoMonBattleStarted, CryptoMonsBattlesaddress));

	//Plasma Channel Manager
	const PlasmaChannelManagerContract = new web3.eth.Contract(PlasmaChannelManagerJson.abi, PlasmaChannelManagerJson.networks["5777"].address);
	// const PlasmaChannelManagerAddress = PlasmaChannelManagerJson.networks["5777"].address;

	const iForceMoveResponded = getEventInterface(PlasmaChannelManagerContract, 'ForceMoveResponded');
	subscribeLogEvent(PlasmaChannelManagerContract, iForceMoveResponded, onForceMoveResponded(iForceMoveResponded));

	const iChannelFunded = getEventInterface(PlasmaChannelManagerContract, 'ChannelFunded');
	subscribeLogEvent(PlasmaChannelManagerContract, iChannelFunded, onChannelFunded(iChannelFunded));

	const iChannelConcluded = getEventInterface(PlasmaChannelManagerContract, 'ChannelConcluded');
	subscribeLogEvent(PlasmaChannelManagerContract, iChannelConcluded, onChannelConcluded(iChannelConcluded));

	const iChannelChallenged = getEventInterface(PlasmaChannelManagerContract, 'ChannelChallenged');
	subscribeLogEvent(PlasmaChannelManagerContract, iChannelChallenged, onChannelConcluded(iChannelChallenged));

	cb();
}