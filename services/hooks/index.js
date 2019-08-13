const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:7545'));
const CryptoMonsJson = require("./CryptoMons.json");
const RootChainJson = require("./RootChain.json");
const BigNumber = require("bignumber.js");
const _ = require('lodash');
const { depositBlock }	= require('../../services/block');

const subscribeLogEvent = (contract, interface, cb) => {
	const subscription = web3.eth.subscribe('logs', {
	  address: contract.options.address,
	  topics: [interface.signature]
	}, cb)

	console.log("Subscribed to event " + interface.name)
}

const getEventInterface = (contract, eventName) => {
	return _.find(
	  contract.jsonInterface.abi.events,
	  o => o.name === eventName,
	)
}


const init = () => {
	const RootChainContract = new web3.eth.Contract(RootChainJson.abi,RootChainJson.networks["5777"].address);
	const CryptoMonContract = new web3.eth.Contract(CryptoMonsJson.abi,CryptoMonsJson.networks["5777"].address);

	const idebugInterface = getEventInterface(RootChainContract, 'Debug');
	subscribeLogEvent(RootChainContract, idebugInterface, (error, result) => {
		console.log(error);
		if (!error) {
			console.log(idebugInterface.abiItem.inputs)
		  const eventObj = web3.eth.abi.decodeLog(
			idebugInterface.abiItem.inputs,
			result.data == "0x" ? undefined : result.data,
			result.topics.slice(1)
		  )
		  console.log(`Debug: `, eventObj)
		}
	})

	const depositInterface = getEventInterface(RootChainContract, 'Deposit');
	subscribeLogEvent(RootChainContract, depositInterface, (error, result) => {
		console.log(error);
		if (!error) {
			console.log(depositInterface.abiItem.inputs)
		  const eventObj = web3.eth.abi.decodeLog(
				depositInterface.abiItem.inputs,
				result.data == "0x" ? undefined : result.data,
				result.topics.slice(1)
			)

			console.log(`Deposit: `, eventObj)
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

			depositBlock(slotBN, blockNumberBN, from, (err) => { console.error(err); });
		}
	})

	const exitInterface = getEventInterface(RootChainContract, 'StartedExit');
	subscribeLogEvent(RootChainContract, exitInterface, (error, result) => {
		console.log(error);
		if (!error) {
			console.log(depositInterface.abiItem.inputs)
		  const eventObj = web3.eth.abi.decodeLog(
				exitInterface.abiItem.inputs,
				result.data == "0x" ? undefined : result.data,
				result.topics.slice(1)
			)
			console.log(`Exit: `, eventObj)
		}
	});

	const transferInterface = getEventInterface(CryptoMonContract, 'Transfer');
	subscribeLogEvent(CryptoMonContract, transferInterface, (error, result) => {
		console.log(error);
		if (!error) {
		  const eventObj = web3.eth.abi.decodeLog(
			transferInterface.abiItem.inputs,
			result.data == "0x" ? undefined : result.data,
			result.topics.slice(1)
		  )
		  console.log(`New Transfer!`, eventObj)
		}
	});

}

module.exports = {
	init
}