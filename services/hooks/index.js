const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://localhost:7545'));
const CryptoMonsJson = require("./CryptoMons.json");
const _ = require('lodash');

const subscribeLogEvent = (contract, eventName, cb) => {
	const eventJsonInterface = _.find(
	  contract.jsonInterface.abi.events,
	  o => o.name === eventName,
	)
	const subscription = web3.eth.subscribe('logs', {
	  address: contract.options.address,
	  topics: [eventJsonInterface.signature]
	}, cb)

	console.log("Subscribed to event " + eventName)
}


const init = () => {
	const CryptoMonsContract = new web3.eth.Contract(CryptoMonsJson.abi,CryptoMonsJson.networks["5777"].address);
	// console.log(CryptoMonsContract);
	subscribeLogEvent(CryptoMonsContract, 'Transfer', (error, result) => {
		console.log(error);
		if (!error) {
		  const eventObj = web3.eth.abi.decodeLog(
			eventJsonInterface.inputs,
			result.data,
			result.topics.slice(1)
		  )
		  console.log(`New ${eventName}!`, eventObj)
		}
	})
}

module.exports = {
	init
}