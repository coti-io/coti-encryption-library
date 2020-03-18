
const stringUtils = require('./stringUtils');
const cryptoUtils = require('./cryptoUtils');
const keccak256 = require('js-sha3').keccak256;

class Signature {
    constructor() {
        if (new.target === Signature) {
            throw new TypeError('Cannot construct Abstract instances directly');
        }
    }

    sign(Wallet, isHash) {
        if (Wallet){
            const keyPair = Wallet.getKeyPair();
            const messageInBytes = isHash ? this.getBytes() : this.createBasicSignatureHash();
            const signatureMessage = Wallet.signMessage(messageInBytes, keyPair);
            this.signatureData = this.editMessageSignatureData(signatureMessage);
            return this.signatureData;
        }
    }

    verify(signatureData, publicKeyInString, isHash) {
        const publicKey = cryptoUtils.getPublicKeyFromString(publicKeyInString);
        const messageInBytes = isHash ? this.getBytes() : this.createBasicSignatureHash();
        var keyPair = cryptoUtils.getKeyPairFromPublic(publicKey);
        return keyPair.verify(messageInBytes, signatureData);
    }

    editMessageSignatureData(signatureMessage){
        delete signatureMessage.recoveryParam;
        signatureMessage.r = signatureMessage.r.toString(16,2);
        signatureMessage.s = signatureMessage.s.toString(16,2);
        return signatureMessage;
    }

    createBasicSignatureHash(){
        var baseTxBytes = this.getBytes();
        var baseTxHashedArray = keccak256.array(baseTxBytes);
        return stringUtils.byteArrayToHexString(baseTxHashedArray);
    }


}

class FullnodeFeeSignatue extends Signature {

    constructor(amount) {
        super();
        this.amount = amount;
    }

    getBytes() {
        let arr = [];
        const amountInBytes = stringUtils.getBytesFromString(cryptoUtils.removeZerosFromEndOfNumber(this.amount.toString()));
        arr = arr.concat(amountInBytes);
        return arr;
    }

}

class OpenDispute extends Signature {

    constructor(transactionHash, items) {
        super();
        this.transactionHash = transactionHash;
        this.items = items;
    }

    getBytes() {

        let itemsByteArray = [];
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.transactionHash));
        this.items.forEach(item => {
            let reason = stringUtils.getBytesFromString(item.reason);
            let id = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(item.id.toString())), 8);
            itemsByteArray = itemsByteArray.concat(id).concat(reason);
        });

        arr = arr.concat(itemsByteArray);

        return arr;
    }

}

class GetDisputes extends Signature {

    constructor(disputeSide) {
        super();
        this.disputeSide = disputeSide;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.getBytesFromString(this.disputeSide));
        return arr;
    }

}


class UploadComments extends Signature {

    constructor(disputeHash, comment, itemIds) {
        super();
        this.disputeHash = disputeHash;
        this.comment = comment;
        this.itemIds = itemIds;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.disputeHash));
        this.itemIds.forEach(itemId => {
            let id = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(itemId.toString())), 8);
            arr = arr.concat(id);
        });
        arr = arr.concat(stringUtils.getBytesFromString(this.comment));
        return arr;
    }

}

class GetDisputeDetails extends Signature {

    constructor(disputeHash, itemId) {
        super();
        this.disputeHash = disputeHash;
        this.itemId = itemId;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.disputeHash));
        let id = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(this.itemId.toString())), 8);
        arr = arr.concat(id);
        return arr;
    }

}

class GetDisputeItemsHistory extends Signature {

    constructor(disputeHash) {
        super();
        this.disputeHash = disputeHash;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.disputeHash));
        return arr;
    }

}

class UploadDocuments extends Signature {

    constructor(disputeHash, itemIds) {
        super();
        this.disputeHash = disputeHash;
        this.itemIds = itemIds;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.disputeHash));
        this.itemIds.forEach(itemId => {
            let id = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(itemId.toString())), 8);
            arr = arr.concat(id);
        });
        return arr;
    }
}

class DownloadDocument extends Signature {

    constructor(documentHash) {
        super();
        this.documentHash = documentHash;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.documentHash));
        return arr;
    }

}

class UpdateItemsStatus extends Signature {

    constructor(disputeHash, itemIds, status) {
        super();
        this.disputeHash = disputeHash;
        this.itemIds = itemIds;
        this.status = status;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.disputeHash));
        this.itemIds.forEach(itemId => {
            let id = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(itemId.toString())), 8);
            arr = arr.concat(id);
        });
        arr = arr.concat(stringUtils.getBytesFromString(this.status));
        return arr;
    }
}

class Vote extends Signature {

    constructor(disputeHash, itemId, status) {
        super();
        this.disputeHash = disputeHash;
        this.itemId = itemId;
        this.status = status;
    }

    getBytes() {
        let arr = [];
        arr = arr.concat(stringUtils.hexToBytes(this.disputeHash));
        let id = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(this.itemId.toString())), 8);
        arr = arr.concat(id);
        arr = arr.concat(stringUtils.getBytesFromString(this.status));
        return arr;
    }
}

class GetUnreadNotifications extends Signature {

    constructor(creationTime) {
        super();
        this.creationTime = creationTime;
    }

    getBytes() {
        let arr = [];
        let timeInBytes = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(this.creationTime)),8);
        arr = arr.concat(timeInBytes);
        return arr;
    }
}

class ClaimStakeReward extends Signature {

    constructor(creationTime) {
        super();
        this.creationTime = creationTime;
    }

    getBytes() {
        let arr = [];
        let timeInBytes = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(this.creationTime)),8);
        arr = arr.concat(timeInBytes);
        return arr;
    }
}

class Unstake extends Signature {

    constructor(creationTime) {
        super();
        this.creationTime = creationTime;
    }

    getBytes() {
        let arr = [];
        let timeInBytes = cryptoUtils.numberToByteArray(Number(cryptoUtils.removeZerosFromEndOfNumber(this.creationTime)),8);
        arr = arr.concat(timeInBytes);
        return arr;
    }
}


module.exports = {
    OpenDispute,
    GetDisputes,
    UploadComments,
    GetDisputeDetails,
    GetDisputeItemsHistory,
    UploadDocuments,
    DownloadDocument,
    UpdateItemsStatus,
    Vote,
    GetUnreadNotifications,
    FullnodeFeeSignatue,
    ClaimStakeReward,
    Unstake
};
