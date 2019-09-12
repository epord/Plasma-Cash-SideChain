# WIP
This is a WIP project on a Token-based Plasma Cash Implementations. 
This repo corresponds to API and Side-Chain in the 3-repo project.

API Side Chain     - https://github.com/epord/Plasma-Cash-SideChain

Front End Client   - https://github.com/epord/CryptoMons-client

Ethereum Contracts - https://github.com/epord/Plasma-Cash-RootChain

Migration to Typescript is being developed on.

# How to Run

## Requirements
1. Install MongoDB using port `dbport` (default is `27017`), and create a database with name `dbname`.
2. Create the file `.env` in the root directory and add the following lines:  
    ```
    PORT=8082                               \\ Port of the API
    MONGO_URL=localhost                     \\ Database URL
    MONGO_PORT=`dbport`                     \\ Database Port
    MONGO_DB_NAME=`dbname`                  \\ Database Name
    BLOCKCHAIN_WS_URL = ws://localhost:7545 \\ Blockchain WebSocket URL 
    AUTO_CHALLENGE = false                  \\ Flag for plasma-challenging the automatically
    ``` 
3. Make sure to check [How to run the blockchain](https://github.com/epord/Plasma-Cash-RootChain) and follow the readme

## Run
1. Make sure the Blockchain is running, follow the readme in  [this repo](https://github.com/epord/Plasma-Cash-RootChain)
2. `npm install`  
3. `npm start`
4. To interact with the API check [How to run the client](https://github.com/epord/CryptoMons-client) and follow the readme  

