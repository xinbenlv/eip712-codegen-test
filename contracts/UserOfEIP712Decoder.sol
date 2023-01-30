// SPDX-License-Identifier: MIT
// Author: Zainan Victor Zhou <zzn-ercref@zzn.im>

pragma solidity ^0.8.9;
import "./EIP712Decoder.sol";

// add hardhat log
import "hardhat/console.sol";

contract UserOfEIP712Decoder is
    EIP712Decoder
{
    uint256 public constant deterministicFakeChainId = 1;
    address public constant deterministicFakeContractAddress = 0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC;
    bytes32 public immutable domainHash;

    constructor(string memory contractName, string memory version) {
        domainHash = getEIP712DomainHash(
            contractName,
            version,
            deterministicFakeChainId, // For deterministic testing
            deterministicFakeContractAddress // For deterministic testing
        );
    }

    function getEIP712DomainHash(
        string memory contractName,
        string memory version,
        uint256 chainId,
        address verifyingContract
    ) public pure returns (bytes32) {
        bytes memory encoded = abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(contractName)),
            keccak256(bytes(version)),
            chainId,
            verifyingContract
        );
        return keccak256(encoded);
    }

    /// @dev This is a test function to expose the domain hash for testing.
    function getDomainHashForTest() public view returns (bytes32) {
        return domainHash;
    }

    function getSigHashForTest(
        uint256 tokenId
    ) public view returns (bytes32) {
        return _getSigHash(tokenId);
    }

    function getFakeChainIdForTest() public pure returns (uint256) {
        return deterministicFakeChainId;
    }

    function getFakeContractAddressForTest() public pure returns (address) {
        return deterministicFakeContractAddress;
    }

    function _getSigHash(
        uint256 tokenId
    ) internal view returns (bytes32) {
        TestDataItem memory testDataItem = TestDataItem({ tokenId: tokenId });
        return getTestDataItemTypedDataHash(
            testDataItem
        );
    }

    function recoverSignature(
        uint256 tokenId,
        bytes memory signature
    ) public view returns (address) {
        require(
            signature.length == 65,
            "FooContract: wrong signature length"
        );

        // Get the top-level hash of that struct, as defined just below:
        bytes32 sigHash = _getSigHash(tokenId);

        // The `recover` method comes from the codegen, and will be able to recover from this:
        address recoveredSignatureSigner = recover(sigHash, signature);

        return recoveredSignatureSigner;
    }

    function getTestDataItemTypedDataHash(
        TestDataItem memory testDataItem
    ) public view returns (bytes32) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                // The domainHash is derived from your contract name and address above:
                domainHash,
                // This last part is calling one of the generated methods.
                // It must match the name of the struct that is the `primaryType` of this signature.
                GET_TESTDATAITEM_PACKETHASH(
                    testDataItem
                )
            )
        );
        return digest;
    }
}
