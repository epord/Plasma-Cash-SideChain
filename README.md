## Install
Install MongoDB using port `dbport` (default is `27017`), and create a database with name `dbname`.

Create the file *.env* in the root directory and add the following lines:  
PORT=8082  
MONGO_URL=localhost  
MONGO_PORT=`dbport`  
MONGO_DB_NAME=`dbname`
BLOCKCHAIN_WS_URL = ws://localhost:7545

Run the following commands:  
`npm install`  
`npm start`  

-----
`ganache-cli -p 7545 -i 5777 --gasLimit=0x1fffffffffffff --allowUnlimitedContractSize -e 1000000000`
`Setup metamask so it uses localhost 7545 and network id 5777`
`Copy one of the private keys and import it to Metamask`
`truffle migrate` - En el repo Plasma-Cash-RootChain
`Go to Remix and paste all the liteInterfaces (Remove the I from the beggining of their names)`
`Copy the migrated address into Remix`
`Buy a CryptoMon with the 0.01 ether`



`npm install -g remixd`
`remixd -s <absolute-path> --remix-ide https://remix.ethereum.org`


## Usefull commands

- Fast-forward time (30 days):
```curl -H "Content-Type: application/json" -X POST --data         '{"id":1337,"jsonrpc":"2.0","method":"evm_increaseTime","params":[2592000]}' http://localhost:7545```
- Mine block in ganache
```curl -H "Content-Type: application/json" -X POST --data         '{"id":1337,"jsonrpc":"2.0","method":"evm_mine","params":[]}'         http://localhost:7545```
- Get latest mined block information:
```web3.eth.getBlock("latest").then(console.log)```
- Usefull ganache commands:
```https://github.com/trufflesuite/ganache-cli#implemented-methods```