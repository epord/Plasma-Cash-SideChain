const EthUtils	= require('ethereumjs-util');
const BigNumber = require('bignumber.js');
const BN = require('bn.js');
const SparseMerkleTree = require('../utils/SparseMerkleTree')
const RLP 				= require('rlp');


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
	const hash = generateTransactionHash(slot, new BigNumber(blockSpent), new BigNumber(1), recipient);
	const signature = EthUtils.ecsign(EthUtils.toBuffer(hash), EthUtils.toBuffer(privateKey));

	// This method simulates eth-sign RPC method
	// https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
	const realSignature = EthUtils.toRpcSig(signature.v, signature.r, signature.s);

	return {
		slot: slot.toFixed(),
		owner: owner,
		recipient: recipient,
		hash: hash,
		blockSpent: blockSpent,
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

module.exports = {
	generateTransactionHash,
	generateTransaction,
	generateDepositBlockRootHash,
	pubToAddress,
	generateSMTFromTransactions,
	getTransactionBytes
};