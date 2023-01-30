import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";
import Ajv from 'ajv';
import { TestDataItemStruct } from "../typechain-types/EIP712Decoder";
const ethSigUtil = require("@metamask/eth-sig-util");
const { SignTypedDataVersion, TypedDataUtils, recoverTypedSignature } = require("@metamask/eth-sig-util");
const typedMessage = require("../../typedef/test-data-struct");

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

/**
 * Validate the given message with the typed message schema.
 *
 * @param typedMessage - The typed message to validate.
 * @returns Whether the message is valid.
 */
function validateTypedMessageSchema(
    typedMessage: Record<string, unknown>,
): boolean {
    const ajv = new Ajv();
    const validate = ajv.compile(TYPED_MESSAGE_SCHEMA);
    return validate(typedMessage);
}
describe("TestUserOfEIP712Decoder", function () {
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, recipient] = await ethers.getSigners();
        const Factory = await ethers.getContractFactory("UserOfEIP712Decoder");
        const contract = await Factory.deploy(
            typedMessage.domain.name,
            typedMessage.domain.version
        );
        return { owner, recipient, contract };
    }

    describe("Deployment", function () {
        it("Should generate match sigs by signTypedData with Both @metamask/eth-sig-util and @hardhat/ethers", async function () {
            const { owner, recipient, contract } = await loadFixture(deployFixture);
            const fakePrivateKeyString = "0x4af1bceebf7f3634ec3cff8a2c38e51178d5d4ce585c52d6043e5e2cc3418bb0";
            const testWallet = new ethers.Wallet(fakePrivateKeyString);
            const fakeChainId = await contract.getFakeChainIdForTest();
            const fakeContractAddress = await contract.getFakeContractAddressForTest();
            const fakeTokenId = ethers.utils.hexZeroPad(ethers.utils.arrayify(0x01), 32);

            let domain = {
                ...typedMessage.domain,
                chainId: fakeChainId,
                verifyingContract: fakeContractAddress
            };
            let message = {
                from: owner.address,
                to: recipient.address,
                fakeTokenId,
            };

            let version = SignTypedDataVersion.V4;
            const privateKeyBuffer = Buffer.from(fakePrivateKeyString, "hex");
            const sigByMetaMask = ethSigUtil.signTypedData({
                privateKey: privateKeyBuffer,
                data: {
                    primaryType: typedMessage.primaryType,
                    domain,
                    types: {
                        EIP712Domain: typedMessage.types.EIP712Domain,
                        TestDataItem: typedMessage.types.TestDataItem
                    },
                    message,
                },
                version: version
            });

            const sigHashByMetaMask = ethers.utils.hexlify(TypedDataUtils.eip712Hash({
                primaryType: typedMessage.primaryType,
                domain,
                types: {
                    EIP712Domain: typedMessage.types.EIP712Domain,
                    TestDataItem: typedMessage.types.TestDataItem
                },
                message,
            }, version));
            const testDataItem:TestDataItemStruct = {
                tokenId: fakeTokenId,
            };
            const packetHash = await contract.GET_TESTDATAITEM_PACKETHASH(
                testDataItem
            );

            let domainHash = await contract.getDomainHashForTest();
            console.log(`DomainHash from Contract =`, domainHash);

            let sigHashByEthers = ethers.utils.keccak256(
                ethers.utils.concat([
                    ethers.utils.toUtf8Bytes('\x19\x01'),
                    ethers.utils.arrayify(domainHash),
                    ethers.utils.arrayify(packetHash)
                ])
            );
            console.log(`SigHash by EthersJS =`, sigHashByEthers);
            let sigHashContract = await contract.getSigHashForTest(
                fakeTokenId);

            console.log(`PacketHash =`, packetHash);

            let sigByHardhat = await testWallet._signTypedData(
                domain,
                types,
                message
            );
            console.log(`sigByMetaMask TS =`, sigByMetaMask);
            let recoveredAddress = recoverTypedSignature({
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
                    primaryType: "FunctionCallTransferFrom"
                },
                version: version
            });
            console.log(`Recovered address TS =`, recoveredAddress);
            expect(ethers.utils.getAddress(recoveredAddress))
                .to.equal(ethers.utils.getAddress(testWallet.address));

            expect(sigByMetaMask).to.equal(sigByHardhat);
            expect(await contract.verifyEndorsement(
                "transferFrom(address from,address to,tokenId)",
                owner.address,
                recipient.address,
                tokenId,
                sigByHardhat
            )).to.equal(testWallet.address);
        });

    });

});
