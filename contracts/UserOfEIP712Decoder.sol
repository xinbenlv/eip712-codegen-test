// SPDX-License-Identifier: MIT
// Author: Zainan Victor Zhou <zzn-ercref@zzn.im>

pragma solidity ^0.8.9;
import "./EIP712Decoder.sol";

// add hardhat log
import "hardhat/console.sol";

contract UserOfEIP712Decoder is
    EIP712Decoder
{
    uint256 public verifyingChainId = 2;
    address public verifyingContract = 0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC;
    bytes32 public immutable domainHash;

    constructor(
        string memory _contractName,
        string memory _version,
        uint256 _verifyingChainId,
        address _verifyingContract) {
        verifyingChainId = _verifyingChainId;
        verifyingContract = _verifyingContract;
        domainHash = getEIP712DomainHash(
            _contractName,
            _version,
            _verifyingChainId, // For deterministic testing
            _verifyingContract // For deterministic testing
        );
    }

    function getEIP712DomainHash(
        string memory _contractName,
        string memory _version,
        uint256 _verifyingChainId,
        address _verifyingContract
    ) public pure returns (bytes32) {
        bytes memory encoded = abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256(bytes(_contractName)),
            keccak256(bytes(_version)),
            _verifyingChainId,
            _verifyingContract
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

    function getVerifyingChainIdForTest() public view returns (uint256) {
        return verifyingChainId;
    }

    function getVerifyingContractAddressForTest() public view returns (address) {
        return verifyingContract;
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
