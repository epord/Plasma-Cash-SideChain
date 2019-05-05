const EthUtils	= require('ethereumjs-util')
, { BigNumber } = require('bignumber.js')
, { BN } = require('bn.js');

// const RLP = require('rlp');


const generateTransactionHash = (slot, blockSpent, owner, recipient) => {
	keccak256(
		EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8), 		// uint64 little endian
		EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
		EthUtils.toBuffer(owner),														// must start with 0x
		EthUtils.toBuffer(recipient),													// must start with 0x
	)
};

const generateLeafHash = (slot, blockSpent, owner, recipient, signature) => {
	keccak256(
		EthUtils.setLengthLeft(new BN(slot.toFixed()).toBuffer(), 64/8), 		// uint64 little endian
		EthUtils.setLengthLeft(new BN(blockSpent.toFixed()).toBuffer(), 256/8),	// uint256 little endian
		EthUtils.toBuffer(owner),														// must start with 0x
		EthUtils.toBuffer(recipient),													// must start with 0x
		EthUtils.toBuffer(signature)													// must start with 0x
	)
};

const generateBlockHeaderHash = (blockNumber, timestamp, lastBlockHeaderHash, rootHash) => {
	keccak256(
		EthUtils.setLengthLeft(new BN(blockNumber.toFixed()).toBuffer(), 256/8), 	// uint256 little endian
		EthUtils.setLengthLeft(new BN(timestamp).toBuffer(), 256/8),				// uint64 little endian
		EthUtils.toBuffer(lastBlockHeaderHash),											// must start with 0x
		EthUtils.toBuffer(rootHash)														// must start with 0x
	)
};

const keccak256 = (...args) => {
	const params = [];
	//TODO: Is pushing enough or should we be using RLP?
	args.forEach((arg) => {
		params.push(arg);
	});

	return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.bufferToHex(Buffer.concat(params))));
};


const pubToAddress = (pubKey) => {
	return EthUtils.bufferToHex(EthUtils.pubToAddress(EthUtils.toBuffer(pubKey)));
};

const generateTransaction = (slot, owner, recipient, blockSpent, privateKey) => {
	const hash = generateTransactionHash(new BigNumber(slot), new BigNumber(blockSpent), owner, recipient);
	const signature = EthUtils.ecsign(EthUtils.toBuffer(hash), EthUtils.toBuffer(privateKey));

	// This method simulates eth-sign RPC method
	// https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
	const realSignature = EthUtils.toRpcSig(signature.v, signature.r, signature.s);

	console.log(JSON.stringify({
		"slot": slot,
		"owner": owner,
		"recipient": recipient,
		"hash": hash,
		"blockSpent": blockSpent,
		"signature": realSignature
	}))

};

module.exports = {
	generateTransactionHash,
	generateLeafHash,
	generateBlockHeaderHash,
	generateTransaction
};