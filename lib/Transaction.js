const keccak256 = require('js-sha3').keccak256;
const BaseTransaction = require('./BaseTransaction');
const stringUtils = require('./stringUtils');

class Transaction {

    constructor(listOfBaseTransaction, descriptionOfTransfer, userHash, type)
    {
        this.baseTransactions =[];
        if (descriptionOfTransfer === null || descriptionOfTransfer === undefined)
            throw new Error('Transaction must have a description');

        for (var i=0; i<listOfBaseTransaction.length; i++ )
        {
            this.baseTransactions.push(listOfBaseTransaction[i]);
        }

        this.createTime = stringUtils.getUtcInstant(); //it gets the utc time in milliseconds
        this.transactionDescription = descriptionOfTransfer;
        this.trustScoreResults = [];
        this.senderHash = userHash;
        this.type = type || 'Transfer';
    }


    addBaseTransaction(address, valueToSend, name)
    {
        var bTransaction = new BaseTransaction(address,valueToSend,name);
        this.baseTransactions.push(bTransaction);
    }

    createTransactionHash(){
        var bytesOfAllBaseTransactions = [];
        for (var i=0; i<this.baseTransactions.length; i++ )
        {
            bytesOfAllBaseTransactions = bytesOfAllBaseTransactions.concat(this.baseTransactions[i].getHashBytes());
        }

        var hasheOfBaseTransactions = keccak256.array(bytesOfAllBaseTransactions);
        this.hash = stringUtils.byteArrayToHexString(hasheOfBaseTransactions);
        return this.hash;
    }

    addTrustScoreMessageToTransaction(trustScoreMessage){
        this.trustScoreResults.push(trustScoreMessage);
    }


    setTrustScoreMessageSignatureData(signatureTrustScoreRequest){
        this.signatureData = signatureTrustScoreRequest;
        delete this.signatureData.recoveryParam;
    }

    createTrustScoreMessage(){
        return { userHash : this.senderHash, transactionHash : this.hash , transactionTrustScoreSignature : this.signatureData};

    }

    getSenderHash(){
        return this.senderHash;
    }

    getTransactionHash(){
        return this.hash;
    }

    signTransaction(Wallet)
    {
        let messageInBytes = [];

        const transactionHashInBytes = stringUtils.hexToBytes(this.hash);
        const transactionTypeInBytes = stringUtils.getBytesFromString(this.type);
        const utcTime = this.createTime * 1000;
        const utcTimeInByteArray = this.numberToByteArray(utcTime, 8);
        const transactionDescriptionInBytes = stringUtils.getBytesFromString(this.transactionDescription);
        messageInBytes = messageInBytes.concat(transactionHashInBytes)
                      .concat(transactionTypeInBytes)
                      .concat(utcTimeInByteArray)
                      .concat(transactionDescriptionInBytes);

        messageInBytes = keccak256.array(messageInBytes);
        messageInBytes = stringUtils.byteArrayToHexString(messageInBytes);

        const signatureMessage = Wallet.signMessage(messageInBytes, Wallet.getKeyPair());
        this.senderSignature =  this.editMessageSignatureData(signatureMessage);
        for (var i=0; i<this.baseTransactions.length; i++ ){
            this.baseTransactions[i].sign(this.hash, Wallet);
        }

    }

    removeZerosFromEndOfNumber(number)
    {
        if(number.includes('.')){
            while (number.charAt(number.length -1) === '0')
            {
                number = number.substring(0,number.length -1);
            }

            if (number.charAt(number.length -1) === '.')
            number = number.substring(0,number.length -1);
        }
        return number;
    }

    numberToByteArray(value, byteLength) {
        var bytes = new Array(byteLength-1);
        for(var k=0; k<byteLength; k++) {
            bytes[byteLength-1-k] = value & (255);
            value = value / 256;
        }
        return bytes;
    }

    editMessageSignatureData(signatureMessage){
        delete signatureMessage.recoveryParam;
        signatureMessage.r = signatureMessage.r.toString(16,2);
        signatureMessage.s = signatureMessage.s.toString(16,2);
        return signatureMessage;
    }

}

module.exports = Transaction;
