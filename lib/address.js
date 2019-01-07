var CRC32 = require('crc-32');   
const keccak256 = require('js-sha3').keccak256;
const stringUtils = require("./stringUtils");
const cryptoUtils = require('./cryptoUtils'); 

var bigdecimal = require("bigdecimal");

class BaseAddress
{
    constructor(addressHex)
    {
        this.checkAddress(addressHex);
        this.addressHex = addressHex;
    }

    checkAddress(addressHex)
    {
        if (addressHex.length != 136)
            throw('address is not correct');
    }

    getAddressHex()
    {
        return this.addressHex;
    }
}





class Address
{
    constructor(keyPair)
    {
        this.keyPair = keyPair;

        var addressKey = this.keyPair;
        var publicXKeyHex = addressKey.getPublic().x.fromRed().toString(16, 2);
        var publicYKeyHex = addressKey.getPublic().y.fromRed().toString(16, 2);

        var checkSum = CRC32.buf(Buffer.from(publicXKeyHex + publicYKeyHex,"hex"));
        var checkSum4Bytes = Array.from(new Uint8Array(cryptoUtils.toBytesInt32(checkSum)));
        var checkSumHex =  stringUtils.byteArrayToHexString(checkSum4Bytes);

        var paddedAddress = cryptoUtils.paddingPublicKey(publicXKeyHex ,publicYKeyHex);

        var addressWithCheckSum = `${paddedAddress}${checkSumHex}`;
        this.BaseAddress = new BaseAddress(addressWithCheckSum)
    }


    getAddressHex()
    {
        return this.BaseAddress.getAddressHex();
    }

    getAddressKeyPair()
    {
        return this.keyPair;
    }

    setBalance(amount)
    {
        this.amount = amount;
    }

    getBalance()
    {
        return this.amount;
    }


    getAmount(amount)
    {
        return  this.preBalance.compareTo(new bigdecimal.BigDecimal('0')) >= 0 ? this.amount  : this.amount.add(preBalance);
    }

    setPreBalance(preBalance)
    {
        this.preBalance = preBalance;
    }

    getPreBalance(amount)
    {
        return this.preBalance;
    }


}




module.exports = {
    BaseAddress:BaseAddress,
    Address : Address,
  }