class BaseAddress {
    constructor(addressHex) {
        this.checkAddress(addressHex);
        this.addressHex = addressHex;
    }

    checkAddress(addressHex) {
        if (addressHex.length !== 136)
            throw new Error('address is not correct');
    }

    getAddressHex() {
        return this.addressHex;
    }

    setBalance(balance) {
        this.balance = balance;
    }

    getBalance() {
        return this.balance;
    }

    setPreBalance(preBalance) {
        this.preBalance = preBalance;
    }

    getPreBalance() {
        return this.preBalance;
    }
}

module.exports = BaseAddress;
