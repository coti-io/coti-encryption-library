const Iservices = require('./wallet.services');
const walletUtils = require('./walletUtils');
const bigdecimal = require('bigdecimal');

class MonitoringProvider {
    constructor() {
        this.addressMap = new Map();
        this.transactionMap = new Map();
    }

    async enableEventPublishing() {
        Iservices(this);
    }

    async loadAddresses(addresses) {
        if(!addresses || !addresses.length) return;
        addresses.forEach(address => {
            this.addressMap.set(address.getAddressHex(), address);
        });
    }

    async loadTransactionHistory(transactions) {
        if(!transactions || !transactions.length) return;
        transactions.forEach(tx => {
            this.transactionMap.set(tx.hash, tx);
        });
    }

    isAddressExists(addressHex) {
        return this.addressMap.has(addressHex);
    }

    getAddresses() {
        return this.addressMap;
    }

    getAddressHexes() {
        return [...this.addressMap.keys()];
    }

    getTransactionByHash(hash) {
        return this.transactionMap.get(hash);
    }

    async checkBalancesOfAddresses(addresses) {
        const addressesBalance = await walletUtils.checkBalances(addresses);
        for(const address of addresses) {
            let { addressBalance, addressPreBalance } = addressesBalance[address.getAddressHex()];
            const balance = new bigdecimal.BigDecimal(`${addressBalance}`);
            const preBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);
            const existingAddress = this.addressMap.get(address.getAddressHex());
            if(!existingAddress || existingAddress.getBalance().compareTo(balance) !== 0 ||
                existingAddress.getPreBalance().compareTo(preBalance) !== 0) {
                this.setAddressWithBalance(address, balance, preBalance);
            }
        }
    }

    setAddressWithBalance(address, balance, preBalance) {

        console.log(`Setting balance for address: ${address.getAddressHex()}, balance: ${balance.toPlainString()}, preBalance: ${preBalance.toPlainString()}`);
        address.setBalance(balance);
        address.setPreBalance(preBalance);
        this.addressMap.set(address.getAddressHex(), address);

        if (typeof this.onBalanceChange === 'function') {
            this.onBalanceChange(address);
        }
    }

    async getTransactionHistory() {
        const addresses = this.getAddressHexes();
        const transactions = await walletUtils.getTransactionsHistory(addresses);
        transactions.forEach(t => {
            this.setTransaction(t);
        });
    }

    setTransaction(tx) {

        const transaction = this.transactionMap.get(tx.hash);

        // If the transaction was already confirmed, no need to reprocess it
        if(transaction && transaction.transactionConsensusUpdateTime === tx.transactionConsensusUpdateTime) {
            return;
        }

        console.log(`Adding transaction with hash: ${tx.hash}, transactionConsensusUpdateTime: ${tx.transactionConsensusUpdateTime}`);
        this.transactionMap.set(tx.hash, tx);

        if (typeof this.onReceivedTransaction === 'function') {
            this.onReceivedTransaction(tx);
        }
    }

}

module.exports = MonitoringProvider;
