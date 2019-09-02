const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:7545'));
const CryptoMonsJson = require("../../json/CryptoMons.json");
const RootChainJson = require("../../json/RootChain.json");
const BigNumber = require("bignumber.js");
const _ = require('lodash');
const { depositBlock }	= require('../block');
const { exitSlot }	= require('../coinState');

//TODO: Cambiar nombre aInterface y ver tipos
const subscribeLogEvent = (contract: { options: { address: any; }; }, aInterface: { signature: any; name: string; }, cb: { (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; (error: any, result: any): void; }) => {
	const subscription = web3.eth.subscribe('logs', {
	  address: contract.options.address,
	  topics: [aInterface.signature]
	}, cb);

	console.log("Subscribed to event " + aInterface.name)
};

//TODO: Ver tipos
const getEventInterface = (contract: { jsonInterface: { abi: { events: any; }; }; }, eventName: string) => {
	return _.find(
	  contract.jsonInterface.abi.events,
        (o: { name: string; }) => o.name === eventName,
	)
};

//TODO: Ver tipos
export const init = () => {
	const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);
	const CryptoMonContract = new web3.eth.Contract(CryptoMonsJson.abi,CryptoMonsJson.networks["5777"].address);

	const idebugInterface = getEventInterface(RootChainContract, 'Debug');
    //TODO: Ver tipos
	subscribeLogEvent(RootChainContract, idebugInterface, (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
		console.log(error);
		if (!error) {
			console.log(idebugInterface.abiItem.inputs);
		  const eventObj = web3.eth.abi.decodeLog(
			idebugInterface.abiItem.inputs,
			result.data == "0x" ? undefined : result.data,
			result.topics.slice(1)
		  );
		  console.log(`Debug: `, eventObj)
		}
	});

	const depositInterface = getEventInterface(RootChainContract, 'Deposit');
    //TODO: Ver tipos
	subscribeLogEvent(RootChainContract, depositInterface, (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
		console.log(error);
		if (!error) {
			console.log(depositInterface.abiItem.inputs);
		  const eventObj = web3.eth.abi.decodeLog(
				depositInterface.abiItem.inputs,
				result.data == "0x" ? undefined : result.data,
				result.topics.slice(1)
			);

			console.log(`Deposit: `, eventObj);
			const { slot, blockNumber, from } = eventObj;
			if (slot == undefined || !from || blockNumber == undefined) {
				console.error('Missing parameter');
				return;
			}

			const slotBN = new BigNumber(slot.toString());
			if(slotBN.isNaN()) {
				console.error('Invalid slot');
				return;
			}

			const blockNumberBN = new BigNumber(blockNumber.toString());
			if(blockNumberBN.isNaN()) {
				console.error('Invalid blockNumber');
				return;
			}

			// TODO: que hacer con errores??

            //TODO: Ver tipos
			depositBlock(slotBN, blockNumberBN, from, (err: any) => { console.error(err); });
		}
	});

	const exitInterface = getEventInterface(RootChainContract, 'StartedExit');
    //TODO: Ver tipos
	subscribeLogEvent(RootChainContract, exitInterface, (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
		console.log(error);
		if (!error) {
			console.log(depositInterface.abiItem.inputs);
		  const eventObj = web3.eth.abi.decodeLog(
				exitInterface.abiItem.inputs,
				result.data == "0x" ? undefined : result.data,
				result.topics.slice(1)
			);
			console.log(`Exit: `, eventObj);
            //TODO: Ver tipos
			exitSlot(eventObj.slot, (err: any) => { if (err) console.log(err) });
		}
	});

	const FexitInterface = getEventInterface(RootChainContract, 'FinalizedExit');
    //TODO: Ver tipos
	subscribeLogEvent(RootChainContract, FexitInterface, (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
		console.log(error);
		if (!error) {
			console.log(depositInterface.abiItem.inputs);
		  const eventObj = web3.eth.abi.decodeLog(
				FexitInterface.abiItem.inputs,
				result.data == "0x" ? undefined : result.data,
				result.topics.slice(1)
			);
			console.log(`FinalizedExit: `, eventObj)
		}
	});

	const transferInterface = getEventInterface(CryptoMonContract, 'Transfer');
    //TODO: Ver tipos
	subscribeLogEvent(CryptoMonContract, transferInterface, (error: any, result: { data: string; topics: { slice: (arg0: number) => void; }; }) => {
		console.log(error);
		if (!error) {
		  const eventObj = web3.eth.abi.decodeLog(
			transferInterface.abiItem.inputs,
			result.data == "0x" ? undefined : result.data,
			result.topics.slice(1)
		  );
		  console.log(`New Transfer!`, eventObj)
		}
	});

};