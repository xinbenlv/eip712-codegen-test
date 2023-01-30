# Test EIP712-codegen

## Script

Setup

```sh
yarn install
npx hardhat compile
```

Generate the `EIP712Decoder.sol`

```sh
npx eip712-codegen ./typedef/test-data-item.js > contracts/EIP712Decoder.sol
```

Run test

```sh
npx hardhat test
```
