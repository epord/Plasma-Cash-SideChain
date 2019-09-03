const { keccak256, bufferToHex, fromRpcSig, ecrecover, toBuffer } = require('ethereumjs-util');


const recover = (hash, signature) => {
  const SignatureMode = [
    'EIP712',
    'GETH',
    'TREZOR'
  ];
  //TODO revise this
  const signatureMode = 'EIP712';
  let _hash = hash;
  if (signatureMode === 'GETH') {
    _hash = bufferToHex(keccak256("\x19Ethereum Signed Message:\n32", hash));
  } else if (signatureMode === 'TREZOR') {
    _hash = bufferToHex(keccak256("\x19Ethereum Signed Message:\n\x20", hash));
  }

  let res = fromRpcSig(signature)
  return bufferToHex(ecrecover(toBuffer(_hash), res.v, res.r, res.s));
};

module.exports = {
  recover
};