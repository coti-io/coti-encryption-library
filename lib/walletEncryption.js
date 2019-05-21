var EC = require('elliptic').ec;
var BN = require('bn.js');
var ec = new EC('secp256k1');
const sha256 = require('js-sha256').sha256;
const sha3_256 = require('js-sha3').sha3_256;
const keccak256 = require('js-sha3').keccak256;
var blake = require('blakejs');
const stringUtils = require("./stringUtils");
const encryptionUtils = require('./cryptoUtils');
const walletUtils = require('./walletUtils');
var addresses = require('./address');
const axios = require('axios');
const bigdecimal = require('bigdecimal');
const Iservices = require('./wallet.services');
const { initSocketConnection } = require('./webSocket.service');
require('dotenv').config();

class walletEncryption {

    constructor(options) {  

        const { seed, userSecret, serverKey, monitoring } = options
        if (seed != null && seed != undefined) {
            if (!this.checkSeedFormat(seed))
                throw ('error seed is not in correct format');
            this.seed = seed;
            this.walletAddressesList = new Map();
        } else
            this._generateSeed(userSecret, serverKey); // should call to server before to get a serverkey ... 
        
        monitoring && Iservices(this);
        this.generateUserHashKeyPair(); 
        monitoring && this.getAddressesDetailsForSeed(); //get addresses from server check if exist get balance and setAddressWithBalance to instance;
    }

    checkSeedFormat(seed) {
        return seed.length == 64;
    }

    async getAddressesDetailsForSeed() {
        const addresses = await walletUtils.getAddressesOfWallet(this);
        addresses.length > 0 ? this.checkBalancesOfAddresses(addresses) : console.log('no addresses') // call to get addresses details
        initSocketConnection(this, addresses);
    }   


    async checkBalancesOfAddresses(addresses) {
        let [addressIndex, generatedAddress, balance, preBalance] = [0];
        const addressesBalance = await walletUtils.checkBalances(addresses)
        do {
            generatedAddress = this.generateAddressByIndex(addressIndex); // starting from 0;
            if (addresses.includes(generatedAddress.getAddressHex())){
                let { addressBalance, addressPreBalance } = addressesBalance[generatedAddress.getAddressHex()];
                balance = new bigdecimal.BigDecimal(`${addressBalance}`);
                preBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);
            }
            this.setAddressWithBalance(generatedAddress, balance, preBalance);
            addressIndex++;
        }while (generatedAddress.getAddressHex() != addresses[addresses.length-1]);
    }

    getIndexByAddress(addressHash) {
        const address = this.walletAddressesList.get(addressHash)
        return address ? address.addressIndex : false; 
    }

    setAddressWithBalance(address, balance, preBalance) {
        address.setBalance(balance);
        address.setPreBalance(preBalance);
        this.walletAddressesList.set(address.getAddressHex(), address)
    }

    getWalletAddresses() {
        return this.walletAddressesList
    }

    isAddressExists(addressHash) {
        return this.walletAddressesList.has(addressHash)
    }

    signMessage(messageInBytes, keyPair) {
        keyPair = keyPair || this.getKeyPair();
        return encryptionUtils.signByteArrayMessage(messageInBytes, keyPair);
    }

    signMessageOfObject(object) {
        return this.signMessage(object.getMessageInBytes());
    }

    getKeyPairFromAddressIndex(indexOfAddress) {
        var seedArray = stringUtils.hexToBytes(this.seed);
        var addressIndex = Array.from(new Uint8Array(encryptionUtils.toBytesInt32(indexOfAddress)));
        var addressWithIndex = seedArray.concat(addressIndex);
        var address = keccak256.array(addressWithIndex);
        var addressPrivateKey = stringUtils.byteArrayToHexString(address)

        while (!encryptionUtils.verifyOrderOfPrivateKey(addressPrivateKey)) {
            var address = keccak256.array(address);
            addressPrivateKey = stringUtils.byteArrayToHexString(address);
        }

        var addressKey = ec.keyFromPrivate(addressPrivateKey);
        return addressKey;
    }

    generateAddressByIndex(indexOfAddress) {
        var addressKey = this.getKeyPairFromAddressIndex(indexOfAddress);
        var address = new addresses.Address(addressKey);
        return address;
    }

    getAddressByIndex(index) {
        return this.generateAddressByIndex(index);
    }


    verifyMessage(message, signedMessage, addressIndex) {
        var keyPair = addressIndex ? this.getKeyPairFromAddressIndex(addressIndex) : this.getUserHash();
        return keyPair.verify(message, signedMessage);
    }


    generateUserPublicHash() {
        this.generateUserHashKeyPair();
        var userHash = encryptionUtils.paddingPublicKey(this.keyPair.getPublic().x.toString('hex'), this.keyPair.getPublic().y.toString('hex'));
        return userHash;
    }

    async getUserTrustScore() {
        let { data } = await walletUtils.getUserTrustScore(this.generateUserPublicHash());
        if (data && data.trustScore) {
            this.userTrustScore = data.trustScore
            console.log('user trust score: ', this.userTrustScore);
        }
    }

    getPublicKeyOfAddressByIndex(addressIndex) {
        var addressKey = this.getKeyPairFromAddressIndex(addressIndex);

        return addressKey.getPublic();
    }

    generateUserHashKeyPair() {
        var privateUserHash;
        var seedInBytes = stringUtils.hexToBytes(this.seed);
        do {
            var privateKeyInBytes = keccak256.array(seedInBytes);
            privateUserHash = stringUtils.byteArrayToHexString(privateKeyInBytes);

        } while (!encryptionUtils.verifyOrderOfPrivateKey(privateUserHash));
        this.setKeyPair(encryptionUtils.getKeyPairFromPrivate(privateUserHash));
    }

    setKeyPair(keyPair) {
        this.keyPair = keyPair;
    }

    getKeyPair() {
        return this.keyPair;
    }

    setPrivateUserHash(privateUserHash) {
        this.privateUserHash = privateUserHash;
    }

    _generateSeed(userSecret, serverKey) {
        var hexServerKey = serverKey.toString(16, 2);
        var combinedString = `${userSecret}${hexServerKey}`
        var sha2Buffer = sha256.array(combinedString);
        var sha3Buffer = sha3_256.array(combinedString);
        var combinedBuffer = sha2Buffer.concat(sha3Buffer);
        var digestedBlake = blake.blake2bHex(Buffer.from(combinedBuffer), null, 32);
        this.setSeedFromHexString(digestedBlake);
    }

    setSeedFromHexString(hexString) {
        this.seed = hexString;
    }
}


module.exports = walletEncryption;