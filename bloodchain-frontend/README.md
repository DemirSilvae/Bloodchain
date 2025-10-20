# BloodChain Frontend

## Dev
```bash
cd action/bloodchain-frontend
npm i
npm run dev
```

Open http://localhost:3000 and input deployed contract addresses.

## Sepolia
- Ensure wallet is on Sepolia.
- The page dynamically loads Relayer SDK UMD and creates an instance with `SepoliaConfig`.
- Use the form to call `recordDonation` and decrypt with userDecrypt (EIP-712).



