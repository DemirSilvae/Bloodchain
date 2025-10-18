# BloodChain Contracts

## Prerequisites
- Node 18+
- A funded Sepolia account matching your MNEMONIC

## Setup
```bash
cd action/bloodchain-contracts
npm i
# create and fill .env
# MNEMONIC="test test ..."
# INFURA_API_KEY=""
# ETHERSCAN_API_KEY=""
```

## Build
```bash
npm run build
```

## Deploy
```bash
# localhost
npm run deploy:localhost

# sepolia
npm run deploy:sepolia
```

Record deployed addresses and feed them to the frontend.

## Verify (optional)
```bash
npm run verify:sepolia -- <ADDRESS_OF_CONTRACT> [...args]
```

