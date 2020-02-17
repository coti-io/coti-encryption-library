const { ec: EC } = require('elliptic');
const ec = new EC('secp256k1');
const { sha256 } = require('js-sha256');
const { sha3_256: sha3Bit256, keccak256 } = require('js-sha3');
var blake = require('blakejs');
const stringUtils = require('./stringUtils');
const encryptionUtils = require('./cryptoUtils');
const walletUtils = require('./walletUtils');
const Address = require('./Address');
const bigdecimal = require('bigdecimal');
const Iservices = require('./wallet.services');
require('dotenv').config();

class Wallet {

    constructor(options) {

        const { seed, userSecret, serverKey } = options;
        if (seed !== null && seed !== undefined) {
            if (!this.checkSeedFormat(seed))
                throw new Error('Seed is not in correct format');
            this.seed = seed;
            this.walletAddressMap = new Map();
            this.transactionList = new Map();
        } else
            this._generateSeed(userSecret, serverKey); // should call to server before to get a serverkey ...

        this.generateUserHashKeyPair();

    }

    checkSeedFormat(seed) {
        return seed.length === 64;
    }

    async enableEventPublishing() {
        Iservices(this);
    }

    async autoDiscoverAddressesForSeed() {
        const addresses = await walletUtils.getAddressesOfWallet(this);
        addresses.length > 0 ? await this.checkBalancesOfAddresses(addresses) : console.log('No addresses'); // call to get addresses details
        return this.getWalletAddresses();
    }

    async checkBalancesOfAddresses(addresses) {
        let [addressIndex, generatedAddress, balance, preBalance] = [0];
        const addressesBalance = await walletUtils.checkBalances(addresses);
        do {
            generatedAddress = this.generateAddressByIndex(addressIndex); // starting from 0;
            if (addresses.includes(generatedAddress.getAddressHex())){
                let { addressBalance, addressPreBalance } = addressesBalance[generatedAddress.getAddressHex()];
                balance = new bigdecimal.BigDecimal(`${addressBalance}`);
                preBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);
            }
            const existingAddress = this.walletAddressMap.get(generatedAddress.getAddressHex());
            if(!existingAddress || existingAddress.getBalance().compareTo(balance) !== 0 ||
                existingAddress.getPreBalance().compareTo(preBalance) !== 0) {
                this.setAddressWithBalance(generatedAddress, balance, preBalance);
            }

            addressIndex++;
        }while (generatedAddress.getAddressHex() !== addresses[addresses.length-1]);
    }

    async loadAddresses(addresses) {
        if(!addresses || !addresses.length) return;
        addresses.forEach(address => {
            this.walletAddressMap.set(address.getAddressHex(), address);
        });
    }

    async loadTransactionHistory(transactions) {
        if(!transactions || !transactions.length) return;
        transactions.forEach(tx => {
            this.transactionList.set(tx.hash, tx);
        });
    }

    getIndexByAddress(addressHash) {
        const address = this.walletAddressMap.get(addressHash);
        return address ? address.index : false;
    }

    setAddressWithBalance(address, balance, preBalance) {

        console.log(`Setting balance for address: ${address.getAddressHex()}, balance: ${balance.toPlainString()}, preBalance: ${preBalance.toPlainString()}`);
        address.setBalance(balance);
        address.setPreBalance(preBalance);
        this.walletAddressMap.set(address.getAddressHex(), address);

        if (typeof this.onBalanceChange === 'function') {
            this.onBalanceChange(address);
        }
    }

    setTransaction(tx) {

        const transaction = this.transactionList.get(tx.hash);

        // If the transaction was already confirmed, no need to reprocess it
        if(transaction && transaction.transactionConsensusUpdateTime === tx.transactionConsensusUpdateTime) {
            return;
        }

        console.log(`Adding transaction with hash: ${tx.hash}, transactionConsensusUpdateTime: ${tx.transactionConsensusUpdateTime}`);
        this.transactionList.set(tx.hash, tx);

        if (typeof this.onReceivedTransaction === 'function') {
            this.onReceivedTransaction(tx);
        }
    }

    async getTransactionHistoryForWallet() {
        const addresses = this.getWalletAddressHexes();
        const transactions = await walletUtils.getTransactionsHistory(addresses);
        transactions.forEach(t => {
            this.setTransaction(t);
        });
    }

    getTransactionByHash(hash) {
        return this.transactionList.get(hash);
    }

    getWalletAddresses() {
        return this.walletAddressMap;
    }

    getWalletAddressHexes() {
        return [...this.walletAddressMap.keys()];
    }

    getTotalBalance(){
        let balance = new bigdecimal.BigDecimal('0');
        let prebalance = new bigdecimal.BigDecimal('0');
        this.walletAddressMap.forEach((addressHex, address) => {
            balance = balance.add(address.getBalance());
            prebalance = prebalance.add(address.getPreBalance());
        });

        return { balance, prebalance };
    }

    isAddressExists(addressHash) {
        return this.walletAddressMap.has(addressHash);
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
        var addressPrivateKeyArray = seedArray.concat(addressIndex);
        addressPrivateKeyArray = keccak256.array(addressPrivateKeyArray);
        var addressPrivateKey = stringUtils.byteArrayToHexString(addressPrivateKeyArray);

        while (!encryptionUtils.verifyOrderOfPrivateKey(addressPrivateKey)) {
            addressPrivateKeyArray = keccak256.array(addressPrivateKeyArray);
            addressPrivateKey = stringUtils.byteArrayToHexString(addressPrivateKeyArray);
        }

        return ec.keyFromPrivate(addressPrivateKey);
    }

    generateAddressByIndex(indexOfAddress) {
        var addressKey = this.getKeyPairFromAddressIndex(indexOfAddress);
        var address = new Address(addressKey, indexOfAddress);
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
        if(!data) throw new Error(`Error getting user trust score, received no data`);
        if(!data.trustScore) throw new Error('Error getting user trust score, unexpected response:', data);
        this.userTrustScore = data.trustScore;
        return this.userTrustScore;
    }

    getPublicKeyOfAddressByIndex(addressIndex) {
        var addressKeyPair = this.getKeyPairFromAddressIndex(addressIndex);

        return addressKeyPair.getPublic();
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
        var combinedString = `${userSecret}${hexServerKey}`;
        var sha2Buffer = sha256.array(combinedString);
        var sha3Buffer = sha3Bit256.array(combinedString);
        var combinedBuffer = sha2Buffer.concat(sha3Buffer);
        var digestedBlake = blake.blake2bHex(Buffer.from(combinedBuffer), null, 32);
        this.setSeedFromHexString(digestedBlake);
    }

    setSeedFromHexString(hexString) {
        this.seed = hexString;
    }
}

module.exports = Wallet;
