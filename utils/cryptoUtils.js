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

const generateTransaction = (tokenId, owner, recipient, blockSpent, privateKey) => {
	const hash = keccak256(tokenId, blockSpent, recipient, owner);
	const signature = EthUtils.ecsign(EthUtils.toBuffer(hash), EthUtils.toBuffer(privateKey));
	const realSignature = EthUtils.toRpcSig(signature.v, signature.r, signature.s)

	console.log(JSON.stringify({
		"tokenId": tokenId,
		"owner": owner,
		"recipient": recipient,
		"hash": hash,
		"blockSpent": blockSpent,
		"signature": realSignature
	}))

}

module.exports = {
	keccak256,
	pubToAddress,
	generateTransaction
};