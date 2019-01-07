
const walletEncryptionLibrary = require('./walletEncryption');
const keccak256 = require('js-sha3').keccak256;


const BasicTransaction = require('./BaseTransaction');
var stringUtils = require('./stringUtils');
const cryptoUtils = require('./cryptoUtils'); 


class Transaction
{

    constructor(listOfBaseTransaction, descriptionOfTransfer, userHash, type)
    {
        this.baseTransactions =[];
        if (descriptionOfTransfer == null || descriptionOfTransfer == undefined)
            throw("transaction must have a description");

        for (var i=0; i<listOfBaseTransaction.length; i++ )
        {
            this.baseTransactions.push(listOfBaseTransaction[i]);
        }
        
        this.createTime = Date.now(); //it gets the utc time
        this.transactionDescription = descriptionOfTransfer;
        this.trustScoreResults = [];
        this.senderHash = userHash;
        this.type = type || 'Transfer';
    }


    addBaseTransaction(address, valueToSend, name)
    {
        var bTransaction = new BasicTransaction(address,valueToSend,name);
        this.baseTransactions.push(bTransaction);
    }

    createTransactionHash(){
        var bytesOfAllBaseTransactions = [];
        for (var i=0; i<this.baseTransactions.length; i++ )
        {
            bytesOfAllBaseTransactions = bytesOfAllBaseTransactions.concat(this.baseTransactions[i].getHashBytes())
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
        delete this.signatureData["recoveryParam"];
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
        for (var i=0; i<this.baseTransactions.length; i++ ){
            this.baseTransactions[i].sign(this.hash, Wallet);
        }
        // const messageInBytes = stringUtils.hexToBytes(this.hash);
        // const signatureMessage = Wallet.signMessage(messageInBytes, Wallet.getKeyPair());
        // this.signatureData =  this.editMessageSignatureData(signatureMessage);
    }

    editMessageSignatureData(signatureMessage){
        delete signatureMessage["recoveryParam"];
        signatureMessage.r = signatureMessage.r.toString();
        signatureMessage.s = signatureMessage.s.toString();
        return signatureMessage;
    }

}


module.exports = Transaction;