const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:7545'));
const CryptoMonsJson = require("./CryptoMons.json");
const RootChainJson = require("./RootChain.json");
const _ = require('lodash');

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

	const interface = getEventInterface(RootChainContract, 'Debug');
	subscribeLogEvent(CryptoMonsContract, interface, (error, result) => {
		console.log(error);
		if (!error) {
			console.log(interface.abiItem.inputs)
		  const eventObj = web3.eth.abi.decodeLog(
			interface.abiItem.inputs,
			result.data == "0x" ? undefined : result.data,
			result.topics.slice(1)
		  )
		  console.log(`New Transfer!`, eventObj)
		}
	})

//	const CryptoMonsContract = new web3.eth.Contract(CryptoMonsJson.abi,CryptoMonsJson.networks["5777"].address);

	// const interface = getEventInterface(CryptoMonsContract, 'Transfer');
	// // console.log(CryptoMonsContract);
	// subscribeLogEvent(CryptoMonsContract, interface, (error, result) => {
	// 	console.log(error);
	// 	if (!error) {
	// 		console.log(interface.abiItem.inputs)
	// 	  const eventObj = web3.eth.abi.decodeLog(
	// 		interface.abiItem.inputs,
	// 		result.data == "0x" ? undefined : result.data,
	// 		result.topics.slice(1)
	// 	  )
	// 	  console.log(`New Transfer!`, eventObj)
	// 	}
	// })
}

module.exports = {
	init
}