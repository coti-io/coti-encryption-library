const cryptoUtils = require('./cryptoUtils');
const stringUtils = require('./stringUtils');
const BaseAddress  = require('./BaseAddress');
const CRC32 = require('crc-32');

class Address extends BaseAddress {
    constructor(keyPair, index) {
        var publicXKeyHex = keyPair.getPublic().x.fromRed().toString(16, 2);
        var publicYKeyHex = keyPair.getPublic().y.fromRed().toString(16, 2);

        var checkSum = CRC32.buf(Buffer.from(publicXKeyHex + publicYKeyHex, 'hex'));
        var checkSum4Bytes = Array.from(new Uint8Array(cryptoUtils.toBytesInt32(checkSum)));
        var checkSumHex = stringUtils.byteArrayToHexString(checkSum4Bytes);

        var paddedAddress = cryptoUtils.paddingPublicKey(publicXKeyHex, publicYKeyHex);

        var addressWithCheckSum = `${paddedAddress}${checkSumHex}`;
        super(addressWithCheckSum);

        this.keyPair = keyPair;
        this.index = index;
    }

    getAddressKeyPair() {
        return this.keyPair;
    }

}


module.exports = Address;
