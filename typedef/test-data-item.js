//
const typedMessage = {
    primaryType: 'TestDataItem',
    domain: {
      name: 'UserOfEIP712Decoder',
      version: '1',
    },

    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TestDataItem: [
        { name: 'tokenId', type: 'uint256' },
      ]
     }
  };

  module.exports = typedMessage;
