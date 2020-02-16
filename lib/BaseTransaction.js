const stringUtils = require('./stringUtils');
const cryptoUtils = require('./cryptoUtils');

const keccak256 = require('js-sha3').keccak256;

class BaseTransaction
{
    constructor(address, amount, name, items, encryptedMerchantName, originalAmount)
    {
        if (!address) return;

        this.addressHash = address.getAddressHex();
        this.amount = amount;
        this.createTime = stringUtils.getUtcInstant(); //it gets the utc time in milliseconds
        this.name = name;
        if(name === 'RBT'){
            this.originalAmount = originalAmount;
        }

        if(name === 'PIBT'){
            this.items = items;
            this.encryptedMerchantName = encryptedMerchantName;
        }

        this.createBasicTransactionHash();
    }

    getBytes()
    {
        var amountInBytes = stringUtils.getBytesFromString(this.removeZerosFromEndOfNumber(this.amount.toString()));
        // var utcTime = Array.from(new Uint8Array(cryptoUtils.toBytesInt32(this.createTime.valueOf())));
        var utcTime = this.createTime * 1000;
        var utcTimeInByteArray = this.numberToByteArray(utcTime, 8);

        var arr = stringUtils.hexToBytes(this.addressHash);
        arr = arr.concat(amountInBytes)
                 .concat(utcTimeInByteArray);

        if (this.name === 'RBT'){
            var originalAmountInBytes = stringUtils.getBytesFromString(this.removeZerosFromEndOfNumber(this.originalAmount.toString()));
            arr = arr.concat(originalAmountInBytes);
        }
        if (this.name === 'PIBT'){
            let itemsByteArray = [];
            this.items.forEach(item => {
                let price = stringUtils.getBytesFromString(this.removeZerosFromEndOfNumber(item.itemPrice.toString()));
                let name = stringUtils.getBytesFromString(item.itemName);
                let quantity = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(item.itemQuantity.toString())), 4);
                let id = this.numberToByteArray(Number(this.removeZerosFromEndOfNumber(item.itemId.toString())), 8);
                itemsByteArray = itemsByteArray.concat(id).concat(price).concat(name).concat(quantity);
            });
            arr = arr.concat(itemsByteArray)
                     .concat(stringUtils.getBytesFromString(this.encryptedMerchantName));
        }

        return arr;
    }

    numberToByteArray(value, byteLength){
        var bytes = new Array(byteLength-1);
        for(var k = 0; k < byteLength; k++) {
            bytes[byteLength-1-k] = value & (255);
            value = value / 256;
        }
        return bytes;
    }


    getBytesToSign()
    {
        var arr = stringUtils.hexToBytes(this.transactionHash);
        return arr;
    }

    getHashBytes()
    {
        return stringUtils.hexToBytes(this.hash);
    }

    createBasicTransactionHash()
    {
        var baseTxBytes = this.getBytes();
        var baseTxHashedArray = keccak256.array(baseTxBytes);
        this.hash = stringUtils.byteArrayToHexString(baseTxHashedArray);
    }


    static getBaseTransactionFromFeeObject(feeObject){
        var baseTransaction = new BaseTransaction();
        baseTransaction.name = feeObject.name;
        baseTransaction.amount = feeObject.amount;
        baseTransaction.addressHash = feeObject.addressHash;
        baseTransaction.createTime = feeObject.createTime;
        if(feeObject.originalAmount){
          baseTransaction.originalAmount = feeObject.originalAmount;
        }
        baseTransaction.hash = feeObject.hash;
        if(feeObject.reducedAmount){
            baseTransaction.reducedAmount = feeObject.reducedAmount;
        }
        if(feeObject.name === 'RRBT'){
            baseTransaction.rollingReserveTrustScoreNodeResult = feeObject.rollingReserveTrustScoreNodeResult;
        }
        else if(feeObject.name === 'NFBT'){
          baseTransaction.networkFeeTrustScoreNodeResult = feeObject.networkFeeTrustScoreNodeResult;
        }
        else if(feeObject.name === 'RBT'){
          baseTransaction.receiverDescription = feeObject.receiverDescription;
          baseTransaction.signatureData = feeObject.signatureData;
        }
        else{
          baseTransaction.signatureData = feeObject.signatureData;
        }

        return baseTransaction;
      }


    setNextBaseTransaction(baseTransaction)
    {
        this.nextBaseTransactionHash = baseTransaction.hash;
    }


    getKeyPair(Wallet){
        return Wallet.getWalletAddresses().get(this.addressHash);
    }

    sign(transactionHash, Wallet)
    {
        if (this.shouldSignTransaction())
        {
            const keyPair = Wallet.getWalletAddresses().get(this.addressHash).keyPair;
            const messageInBytes = stringUtils.hexToBytes(transactionHash);
            this.transactionHash = transactionHash;
            const signatureMessage = Wallet.signMessage(messageInBytes, keyPair);
            this.signatureData =  this.editMessageSignatureData(signatureMessage);
            return this.signatureData;
        }
    }

    editMessageSignatureData(signatureMessage){
        delete signatureMessage['recoveryParam'];
        signatureMessage.r = signatureMessage.r.toString(16,2);
        signatureMessage.s = signatureMessage.s.toString(16,2);
        return signatureMessage;
    }

    shouldSignTransaction()
    {
        return this.amount < 0;
    }

    signBytes(byteArray)
    {
        var messageSigned =  cryptoUtils.signByteArrayMessage(byteArray,this);
        return messageSigned;
    }

    toJSON()
    {
        var jsonToReturn = {};


        jsonToReturn['addressHash'] = this.addressHash;
        jsonToReturn['amount']  = this.removeZerosFromEndOfNumber(this.amount.toString());
        jsonToReturn['hash'] = this.hash;
        jsonToReturn['createTime'] = this.createTime; //it gets the utc time


        if (this.signatureData !== null && this.signatureData !== undefined)
        {
            jsonToReturn['signatureData'] =  { 'r' : this.signatureData.r, 's' : this.signatureData.s}
        }

        if (this.originalAmount != null && this.originalAmount!== undefined){
            jsonToReturn['originalAmount'] = this.removeZerosFromEndOfNumber(this.originalAmount.toString());
        }

        if (this.networkFeeTrustScoreNodeResult !== null && this.networkFeeTrustScoreNodeResult !== undefined)
            jsonToReturn['networkFeeTrustScoreNodeResult'] = this.networkFeeTrustScoreNodeResult;
        if (this.encryptedMerchantName)
            jsonToReturn['encryptedMerchantName'] = this.encryptedMerchantName;
        if (this.items)
            jsonToReturn['items'] = this.items;
        if (this.rollingReserveTrustScoreNodeResult)
            jsonToReturn['rollingReserveTrustScoreNodeResult'] = this.rollingReserveTrustScoreNodeResult;
        if (this.receiverDescription)
            jsonToReturn['receiverDescription'] = this.receiverDescription;

        if (this.reducedAmount !== null && this.reducedAmount !== undefined)
            jsonToReturn['reducedAmount'] = this.removeZerosFromEndOfNumber(this.reducedAmount.toString());


        jsonToReturn['name'] = this.name;

        return jsonToReturn;
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
}

module.exports = BaseTransaction;
