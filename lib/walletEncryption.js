var EC = require('elliptic').ec;
var BN = require('bn.js');
var ec = new EC('secp256k1');
const sha256 = require('js-sha256').sha256;
const sha3_256 = require('js-sha3').sha3_256;
const keccak256 = require('js-sha3').keccak256;
var blake = require('blakejs');
const stringUtils = require("./stringUtils");
const encryptionUtils = require('./cryptoUtils'); 
var addresses = require('./address');

class walletEncryption
{

    
    constructor(seed , userSecret, serverKey) 
    {
        if (seed != null && seed != undefined)
        {
            
            if (!this.checkSeedFormat(seed))
                throw('error seed is not in correct format');
            this.seed=seed;    
            this.walletAddressesList = new Map();
        }
        else
            this._generateSeed(userSecret,serverKey);    
        this.generateUserHashKeyPair();
    }

    checkSeedFormat(seed)
    {
        return seed.length == 64;
    }

    getIndexByAddress(addressHash)
    {
        return this.walletAddressesList.get(addressHash).addressIndex; // todo : check if works;
    }
    
    setAddressWithBalance(address, balance, preBalance)
    {
        address.setBalance(balance);
        address.setPreBalance(preBalance);
        this.walletAddressesList.set(address.getAddressHex(), address)
    }
    
    getWalletAddresses()
    {
        return this.walletAddressesList
    }

    isAddressExists(addressHash)
    {
        return this.walletAddressesList.has(addressHash)
    }

    signMessage(messageInBytes, keyPair)
    {

        keyPair = keyPair || this.getKeyPair();
        return encryptionUtils.signByteArrayMessage(messageInBytes, keyPair);
        
    }

    signMessageOfObject(object)
    {
        return this.signMessage(object.getMessageInBytes());      
    }


    getKeyPairFromAddressIndex(indexOfAddress)
    {
        var seedArray = stringUtils.hexToBytes(this.seed);
        var addressIndex = Array.from(new Uint8Array(encryptionUtils.toBytesInt32(indexOfAddress)));
        var addressWithIndex = seedArray.concat(addressIndex);
        var address = keccak256.array(addressWithIndex);
        var addressPrivateKey = stringUtils.byteArrayToHexString(address)
        
        while (!encryptionUtils.verifyOrderOfPrivateKey(addressPrivateKey))
        {
            var address = keccak256.array(address);
            addressPrivateKey = stringUtils.byteArrayToHexString(address);
        }

        var addressKey = ec.keyFromPrivate(addressPrivateKey);
        return addressKey;
    }

    generateAddressByIndex(indexOfAddress)
    {
        var addressKey = this.getKeyPairFromAddressIndex(indexOfAddress);
        var address = new addresses.Address(addressKey);
        return address;
    }

    getAddressByIndex(index)
    {
        return this.generateAddressByIndex(index);
    }


    generateAddressByIndex(indexOfAddress)
    {
        var addressKey = this.getKeyPairFromAddressIndex(indexOfAddress);
        var address = new addresses.Address(addressKey);
        return address;
    }

    verifyMessage(message,signedMessage,addressIndex)
    {
        var keyPair = addressIndex ? this.getKeyPairFromAddressIndex(addressIndex) : this.getUserHash();
        return keyPair.verify(message,signedMessage);
    }


    generateUserPublicHash(){
            this.generateUserHashKeyPair();
            var userHash = encryptionUtils.paddingPublicKey(this.keyPair.getPublic().x.toString('hex') , this.keyPair.getPublic().y.toString('hex'));
            return userHash;
    }
    

    getPublicKeyOfAddressByIndex(addressIndex)
    {
        var addressKey = this.getKeyPairFromAddressIndex(addressIndex);

        return addressKey.getPublic();
    }

    generateUserHashKeyPair()
    {
        var privateUserHash;
        var seedInBytes = stringUtils.hexToBytes(this.seed);
        do {
            var privateKeyInBytes = keccak256.array(seedInBytes);
            privateUserHash = stringUtils.byteArrayToHexString(privateKeyInBytes);
            
        } while(!encryptionUtils.verifyOrderOfPrivateKey(privateUserHash));
        this.setKeyPair(encryptionUtils.getKeyPairFromPrivate(privateUserHash));
    }
    
    setKeyPair(keyPair)
    {
        this.keyPair = keyPair;
    }

    getKeyPair() {
        return this.keyPair;
    }

    setPrivateUserHash(privateUserHash)
    {
        this.privateUserHash = privateUserHash;
    }

    _generateSeed(userSecret,serverKey)
    {
        var hexServerKey = serverKey.toString(16,2);
        var combinedString = `${userSecret}${hexServerKey}`   
        var sha2Buffer = sha256.array(combinedString);
        var sha3Buffer = sha3_256.array(combinedString);
        var combinedBuffer = sha2Buffer.concat(sha3Buffer);
        var digestedBlake = blake.blake2bHex(Buffer.from(combinedBuffer),null,32);
        this.setSeedFromHexString(digestedBlake);        
    }

    setSeedFromHexString(hexString) {
        this.seed = hexString;
    }
}

module.exports = walletEncryption;