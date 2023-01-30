import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import Ajv from 'ajv';
import { TestDataItemStruct } from "../typechain-types/EIP712Decoder";
import exp from "constants";
const ethSigUtil = require("@metamask/eth-sig-util");
const { SignTypedDataVersion, TypedDataUtils, recoverTypedSignature } = require("@metamask/eth-sig-util");
const typedMessage = require("../typedef/test-data-item");

export const TYPED_MESSAGE_SCHEMA = {
    type: 'object',
    properties: {
        types: {
            type: 'object',
            additionalProperties: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                    },
                    required: ['name', 'type'],
                },
            },
        },
        primaryType: { type: 'string' },
        domain: { type: 'object' },
        message: { type: 'object' },
    },
    required: ['types', 'primaryType', 'domain', 'message'],
};

describe("TestUserOfEIP712Decoder", function () {

    for (let fakeChainId of [1, 2]) {
        async function deployFixture() {
            // Contracts are deployed using the first signer/account by default
            const [owner, recipient] = await ethers.getSigners();
            const Factory = await ethers.getContractFactory("UserOfEIP712Decoder");
            const fakeContractAddress = "0xcccccccccccccccccccccccccccccccccccccccc";
            const contract = await Factory.deploy(
                typedMessage.domain.name,
                typedMessage.domain.version,
                fakeChainId,
                fakeContractAddress
            );
            const fakePrivateKeyString = "4af1bceebf7f3634ec3cff8a2c38e51178d5d4ce585c52d6043e5e2cc3418bb0";
            const testWallet = new ethers.Wallet("0x" + fakePrivateKeyString);
            const fakeTokenId = 123;

            let domain = {
                ...typedMessage.domain,
                chainId: fakeChainId,
                verifyingContract: fakeContractAddress
            };
            let message = {
                tokenId: fakeTokenId,
            };

            let version = SignTypedDataVersion.V4;
            const privateKeyBuffer = Buffer.from(fakePrivateKeyString, "hex");
            let types = {
                TestDataItem: typedMessage.types.TestDataItem
            };
            let typesWithEIP712Domain = {
                ...types,
                EIP712Domain: typedMessage.types.EIP712Domain
            };
            const sigHashContract = await contract.getSigHashForTest(fakeTokenId);

            return {
                owner, recipient,
                contract,
                testWallet,
                fakeContractAddress,
                fakeTokenId,
                fakePrivateKeyString,
                domain, message, version, privateKeyBuffer, types, typesWithEIP712Domain,
                sigHashContract,
            };
        }
        describe(`With chainId= ${fakeChainId}`, function () {
            it("Contract should yield same sigHash with MetaMask", async function() {
                const { domain, message, version, typesWithEIP712Domain, sigHashContract } = await loadFixture(deployFixture);
                const sigHashByMetaMask = ethers.utils.hexlify(TypedDataUtils.eip712Hash({
                    primaryType: typedMessage.primaryType,
                    domain,
                    types: typesWithEIP712Domain,
                    message,
                }, version));
                expect(sigHashByMetaMask).to.equal(sigHashContract);
            });

            it("Contract should yield same sigHash with Hardhat/Ethers", async function() {
                const { domain, message, version, typesWithEIP712Domain, fakeTokenId, sigHashContract, contract } = await loadFixture(deployFixture);
                const testDataItem:TestDataItemStruct = {
                    tokenId: fakeTokenId,
                };
                const packetHash = await contract.GET_TESTDATAITEM_PACKETHASH(
                    testDataItem
                );

                let domainHash = await contract.getDomainHashForTest();

                let sigHashByEthers = ethers.utils.keccak256(
                    ethers.utils.concat([
                        ethers.utils.toUtf8Bytes('\x19\x01'),
                        ethers.utils.arrayify(domainHash),
                        ethers.utils.arrayify(packetHash)
                    ])
                );
                expect(sigHashByEthers).to.equal(sigHashContract);
            });

            it("MetaMask and Hardhat/Ethers should yield same signatures", async function() {
                const { domain, message, version, typesWithEIP712Domain, sigHashContract, privateKeyBuffer, testWallet, types } = await loadFixture(deployFixture);
                const sigByMetaMask = ethSigUtil.signTypedData({
                    privateKey: privateKeyBuffer,
                    data: {
                        primaryType: typedMessage.primaryType,
                        domain,
                        types: typesWithEIP712Domain,
                        message,
                    },
                    version: version
                });
                const sigByHardhat = await testWallet._signTypedData(
                    domain,
                    types,
                    message
                );
                expect(sigByMetaMask).to.equal(sigByHardhat);
            });

            it("MetaMask should recover to address with Hardhat/Ethers", async function () {
                const { domain, message, version, typesWithEIP712Domain, sigHashContract, privateKeyBuffer, testWallet, types } = await loadFixture(deployFixture);

                const sigByMetaMask = ethSigUtil.signTypedData({
                    privateKey: privateKeyBuffer,
                    data: {
                        primaryType: typedMessage.primaryType,
                        domain,
                        types: typesWithEIP712Domain,
                        message,
                    },
                    version: version
                });
                const sigByHardhat = await testWallet._signTypedData(
                    domain,
                    types,
                    message
                );
                expect(sigByMetaMask).to.equal(sigByHardhat);
                const metaMaskRecoveredAddress = recoverTypedSignature({
                    signature: sigByMetaMask,
                    data: {
                        domain,
                        types: { ...types,
                            EIP712Domain: [
                                { name: 'name', type: 'string' },
                                { name: 'version', type: 'string' },
                                { name: 'chainId', type: 'uint256' },
                                { name: 'verifyingContract', type: 'address' },
                            ]
                        } ,
                        message,
                        primaryType: typedMessage.primaryType
                    },
                    version: version
                });
                const ethersRecoveredAddress = await ethers.utils.recoverAddress(
                    sigHashContract,
                    sigByHardhat
                );
                expect(
                    ethers.utils.getAddress(metaMaskRecoveredAddress))
                    .to.equal(ethers.utils.getAddress(ethersRecoveredAddress));
            });
            it("Contract should recover same address with MetaMask", async function () {
                const {contract, domain, message, version, typesWithEIP712Domain, sigHashContract, privateKeyBuffer, testWallet, types, fakeTokenId } = await loadFixture(deployFixture);
                const sigByMetaMask = ethSigUtil.signTypedData({
                    privateKey: privateKeyBuffer,
                    data: {
                        primaryType: typedMessage.primaryType,
                        domain,
                        types: typesWithEIP712Domain,
                        message,
                    },
                    version: version
                });
                const metaMaskRecoveredAddress = recoverTypedSignature({
                    signature: sigByMetaMask,
                    data: {
                        domain,
                        types: { ...types,
                            EIP712Domain: [
                                { name: 'name', type: 'string' },
                                { name: 'version', type: 'string' },
                                { name: 'chainId', type: 'uint256' },
                                { name: 'verifyingContract', type: 'address' },
                            ]
                        } ,
                        message,
                        primaryType: typedMessage.primaryType
                    },
                    version: version
                });
                const contractRecoveredAddress = await contract.recoverSignature(fakeTokenId, sigByMetaMask);
                expect(ethers.utils.getAddress(contractRecoveredAddress)).to.equal(ethers.utils.getAddress(metaMaskRecoveredAddress));
            });

        });
    }


});
