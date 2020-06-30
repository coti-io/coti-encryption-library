var BN = require('bn.js');
var CRC32 = require('crc-32');
var EC = require('elliptic').ec;
var ec = new EC('secp256k1');
const stringUtils = require('./stringUtils');
const regexp = /^[0-9a-fA-F]+$/;
const publicKeyLength = 128;
const crypto = require('crypto');
const orderGHex = 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141';
const orderG = new BN(orderGHex,16);


module.exports = {
    encryptGCM(data,password,iv) {
        var cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(password), iv);
        var encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        var tag = cipher.getAuthTag();
        return {
          content: encrypted,
          tag: tag
        }},
    decryptGCM(encrypted,password, iv) {

            var decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(password), iv);
            decipher.setAuthTag(encrypted.tag);
            var dec = decipher.update(encrypted.content, 'hex', 'utf8');
            dec += decipher.final('utf8');
            return dec;
    },
    encryptCTR(text, password) {
        var cipher = crypto.createCipher('aes-256-ctr',password);
        var crypted = cipher.update(text,'utf8','hex');
        crypted += cipher.final('hex');
        return crypted;
    },
    decryptCTR(text, password) {
        var decipher = crypto.createDecipher('aes-256-ctr',password);
        var dec = decipher.update(text,'hex','utf8');
        dec += decipher.final('utf8');
        return dec;
    },
    getCrc32 : function (hex){
        var arr = Buffer.from(hex,'hex');
        var checkSum = CRC32.buf(arr,'hex');
        var checkSum4Bytes = Array.from(new Uint8Array(this.toBytesInt32(checkSum)));
        var checkSumHex =  stringUtils.byteArrayToHexString(checkSum4Bytes);
        return checkSumHex;
    },
    generateKeyPair : function(){
        var keyPair = ec.genKeyPair();
        return keyPair;
    },
    generatePrivateKey : function(){
        var keyPair = this.generateKeyPair();
        var privateKey =  keyPair.getPrivate('hex');
        return privateKey;
    },
    getKeyPairFromPrivate : function (privateKey){
        var keyPair = ec.keyFromPrivate(new BN(privateKey, 16),ec);
        return keyPair;
    },
    getKeyPairFromPublic : function (publicKey){
        var keyPair = ec.keyFromPublic(publicKey,'hex');
        return keyPair;
    },
    verifySignature : function (messageInBytes, signature, publicKey) {
        var keyPair = this.getKeyPairFromPublic(publicKey);
        return keyPair.verify(messageInBytes, signature);
    },
    getPublicKeyFromString : function(publicKeyInString) {
        if(!this.validatePublicKey(publicKeyInString))
            throw new Error('Invalid public key');
        return { x: publicKeyInString.substr(0,64), y: publicKeyInString.substr(64,128) };
    },
    validatePublicKey : function(publicKey){

        if (publicKey === null || publicKey === undefined || publicKey.length !== publicKeyLength)
            return false;

        if (!regexp.test(publicKey))
            return false;
        return true;
    },
    verifyOrderOfPrivateKey : function(privateKey)
    {
        privateKey =  new BN(privateKey, 16);
        if (orderG.cmp(privateKey) >= 0)
            return true;
        return false;
    },
    paddingPublicKey : function(publicKeyX, publicKeyY)
    {
        var paddingLetter = '0';
        var publicX = publicKeyX;
        var publicY = publicKeyY;

        if (publicKeyX.length < 64)
        {
            for (let i = publicKeyX.length; i < 64; i++)
            {
                publicX = paddingLetter + publicX;
            }
        }

        if (publicKeyY.length < 64)
        {
            for (let i = publicKeyY.length; i < 64; i++)
            {
                publicY = paddingLetter + publicY;
            }
        }
        return publicX + publicY;
    },
    toBytesInt32 :function(num) {
        var arr = new ArrayBuffer(4); // an Int32 takes 4 bytes
        var view = new DataView(arr);
        view.setInt32(0, num, false); // byteOffset = 0; litteEndian = false
        return arr;
    },
    numberToByteArray(value, byteLength){
        var bytes = new Array(byteLength-1);
        for(var k=0; k<byteLength; k++) {
            bytes[byteLength-1-k] = value & (255);
            value = value / 256;
        }
        return bytes;
    },
    removeZerosFromEndOfNumber(number){
        if(number.includes('.')){
            while (number.charAt(number.length -1) === '0')
            {
                number = number.substring(0,number.length -1);
            }

            if (number.charAt(number.length -1) === '.')
            number = number.substring(0,number.length -1);
        }
        return number;
    },
    signByteArrayMessage(byteArray, keyPair)
    {
        return keyPair.sign(byteArray);
    },
    verifyAddressStructure(addressHex){

        if (addressHex.length !== 136)
            return false;

        var arr = Buffer.from(addressHex.substring(0,128),'hex');
        var checkSum = CRC32.buf(arr,'hex');
        var checkSum4Bytes = Array.from(new Uint8Array(this.toBytesInt32(checkSum)));
        var checkSumHex =  stringUtils.byteArrayToHexString(checkSum4Bytes);
        return checkSumHex === addressHex.substring(128,136);
    }
};
