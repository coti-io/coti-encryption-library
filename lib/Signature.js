
const stringUtils = require('./stringUtils');
const cryptoUtils = require('./cryptoUtils'); 
const keccak256 = require('js-sha3').keccak256;

class Signature {
    constructor() {
        if (new.target === Signature) {
            throw new TypeError("Cannot construct Abstract instances directly");
        }
    }

    numberToByteArray(value, byteLength){ 
        var bytes = new Array(byteLength-1);
        for(var k=0;k<byteLength;k++) {
            bytes[byteLength-1-k] = value & (255);
            value = value / 256;
        }
        return bytes
    }

    removeZerosFromEndOfNumber(number){
        if(number.includes('.')){
            while (number.charAt(number.length -1) === "0")
            {
                number = number.substring(0,number.length -1);
            }
            
            if (number.charAt(number.length -1)== ".")
            number = number.substring(0,number.length -1);
        }
        return number;
    }

    sign(Wallet) {
        if (Wallet){
            const keyPair = Wallet.getKeyPair();
            const messageInBytes = this.createBasicSignatureHash();
            const signatureMessage = Wallet.signMessage(messageInBytes, keyPair);
            this.signatureData = this.editMessageSignatureData(signatureMessage);
            return this.signatureData;
        }
    }

    editMessageSignatureData(signatureMessage){
        delete signatureMessage["recoveryParam"];
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
            let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(item.id.toString())), 8);
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
            let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(itemId.toString())), 8);
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
        let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(this.itemId.toString())), 8);
        arr = arr.concat(id);
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
            let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(itemId.toString())), 8);
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

    sign(Wallet) {
        if (Wallet){
            const keyPair = Wallet.getKeyPair();
            const messageInBytes = this.getBytes();
            const signatureMessage = Wallet.signMessage(messageInBytes, keyPair);
            this.signatureData = this.editMessageSignatureData(signatureMessage);
            return this.signatureData;
        }
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
            let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(itemId.toString())), 8);
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
        let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(this.itemId.toString())), 8);
        arr = arr.concat(id);
        arr = arr.concat(stringUtils.getBytesFromString(this.status));
        return arr;
    }
}


module.exports = {OpenDispute, GetDisputes, UploadComments, GetDisputeDetails, UploadDocuments, DownloadDocument, UpdateItemsStatus, Vote};