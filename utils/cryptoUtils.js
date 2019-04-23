const EthUtils	= require('ethereumjs-util');

const keccak256 = (...args) => {
	const params = [];
	args.forEach((arg) => {
		params.push(EthUtils.toBuffer(arg));
	});
	return EthUtils.bufferToHex(EthUtils.keccak256(EthUtils.bufferToHex(Buffer.concat(params))));
}

const pubToAddress = (pubKey) => {
	return EthUtils.bufferToHex(EthUtils.pubToAddress(EthUtils.toBuffer(pubKey)));
}

module.exports = {
	keccak256,
	pubToAddress
};