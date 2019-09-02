const EthUtils	= require('ethereumjs-util');
const BigNumber = require('bignumber.js');
const BN = require('bn.js');
const SparseMerkleTree = require('./SparseMerkleTree')
const RLP 				= require('rlp');
const Web3 = require('web3');
const web3 = new Web3(new Web3.providers.WebsocketProvider(process.env.BLOCKCHAIN_WS_URL));
const CryptoMonsJson = require("../json/CryptoMons.json");
const RootChainJson = require("../json/RootChain.json");
const VMCJson = require("../json/ValidatorManagerContract.json");

const generateTransactionHash = (slot, blockSpent, denonimation, recipient) => {
	if(blockSpent.isZero()) {
		return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8))) //uint64 little endian
	} else {
		return EthUtils.bufferToHex(EthUtils.keccak256(getTransactionBytes(slot, blockSpent, denonimation, recipient)))
	}
};

const getTransactionBytes = (slot, blockSpent, denomination, recipient) => {
	const params = [
			EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 256/8), 			// uint256 little endian
			EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
			EthUtils.setLengthLeft(new BN(denomination.toFixed()).toBuffer(), 256/8),	// uint256 little endian
			EthUtils.toBuffer(recipient),																						// must start with 0x
	];

	return EthUtils.bufferToHex(RLP.encode(params));
}


const generateDepositBlockRootHash = (slot) => {
	return keccak256(
		EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8), 		// uint64 little endian
	)
};

const keccak256 = (...args) => {
	const params = [];
	args.forEach((arg) => {
		params.push(arg);
	});

	return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.bufferToHex(Buffer.concat(params))));
};


const pubToAddress = (pubKey) => {
	return EthUtils.bufferToHex(EthUtils.pubToAddress(EthUtils.toBuffer(pubKey)));
};

const generateTransaction = (slot, owner, recipient, blockSpent, privateKey) => {
	//TODO migrate slot and blockSpent to BigNumber
	const slotBN = new BigNumber(slot);
	const blockSpentBN = new BigNumber(blockSpent);
	const hash = generateTransactionHash(slotBN, blockSpentBN, new BigNumber(1), recipient);
	const signature = EthUtils.ecsign(EthUtils.toBuffer(hash), EthUtils.toBuffer(privateKey));

	// This method simulates eth-sign RPC method
	// https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
	const realSignature = EthUtils.toRpcSig(signature.v, signature.r, signature.s);

	return {
		slot: slotBN.toFixed(),
		owner: owner,
		recipient: recipient,
		hash: hash,
		blockSpent: blockSpentBN.toFixed(),
		signature: realSignature
	};

};

const generateSMTFromTransactions = (transactions) => {
	const leaves = transactions.reduce((map, value) => {
		map[value.slot] = generateTransactionHash(
			value.slot,
			value.block_spent,
			new BigNumber(1),
			value.recipient
		);
		return map;
	}, {});

	return new SparseMerkleTree(64, leaves);
}


const submitBlock = (block, cb) => {
	const RootChainContract = new web3.eth.Contract(RootChainJson.abi, RootChainJson.networks["5777"].address);
	web3.eth.getAccounts().then(accounts => {
		if (!accounts || accounts.length == 0) return cb(err);
		RootChainContract.methods.submitBlock(block._id.toFixed(), block.root_hash).send({from: accounts[0]}, (err, res) => {
			if (err) return cb(err);
			cb();
		});
	});
};


const validateCryptoMons = (cb) => {
	const VMC = new web3.eth.Contract(VMCJson.abi, VMCJson.networks["5777"].address);
	web3.eth.getAccounts().then(accounts => {
		if (!accounts || accounts.length == 0) return cb(err);
		VMC.methods.setToken(CryptoMonsJson.networks["5777"].address, true).send({from: accounts[0]}, (err, res) => {
			if (err) return cb(err);
			console.log("Validated contract")
			cb();
		});
	});
}


module.exports = {
	generateTransactionHash,
	generateTransaction,
	generateDepositBlockRootHash,
	pubToAddress,
	generateSMTFromTransactions,
	getTransactionBytes,
	submitBlock,
	validateCryptoMons
};