## Install
Check that you have a mongo database running and specify the port in .env file.

`npm install`
`npm start`

## Usefull commands

- Fast-forward time (30 days):
```curl -H "Content-Type: application/json" -X POST --data         '{"id":1337,"jsonrpc":"2.0","method":"evm_increaseTime","params":[2592000]}' http://localhost:7545```
- Mine block in ganache
```curl -H "Content-Type: application/json" -X POST --data         '{"id":1337,"jsonrpc":"2.0","method":"evm_mine","params":[]}'         http://localhost:7545```
- Get latest mined block information:
```web3.eth.getBlock("latest").then(console.log)```
- Usefull ganache commands:
```https://github.com/trufflesuite/ganache-cli#implemented-methods```