## Install
Install MongoDB using port `dbport` (default is `27017`), and create a database with name `dbname`.

Create the file *.env* in the root directory and add the following lines:  
PORT=8082  
MONGO_URL=localhost  
MONGO_PORT=`dbport`  
MONGO_DB_NAME=`dbname`

Run the following commands:  
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