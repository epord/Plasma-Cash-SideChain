const { keccak256, bufferToHex, fromRpcSig, ecrecover, toBuffer } = require('ethereumjs-util');


export const recover = (hash: string, signature: string) => {
  const SignatureMode = [
    'EIP712',
    'GETH',
    'TREZOR'
  ];

  let _hash = hash;

  //TODO revise this
  // if (signatureMode === 'GETH') {
  //   _hash = bufferToHex(keccak256("\x19Ethereum Signed Message:\n32", hash));
  // } else if (signatureMode === 'TREZOR') {
  //   _hash = bufferToHex(keccak256("\x19Ethereum Signed Message:\n\x20", hash));
  // }

  let res = fromRpcSig(signature);
  return bufferToHex(ecrecover(toBuffer(_hash), res.v, res.r, res.s));
};
