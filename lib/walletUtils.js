const axios = require('axios');
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const TRUSTSCORE_URL = process.env.TRUSTSCORE_URL;
const wallet_addresses_inital_values = [ [], [], 0, false ];

const self = module.exports = {
  getUserTrustScore: async userHash => {
    try {
      return await axios.post(`${TRUSTSCORE_URL}/usertrustscore`, {
        userHash
      });
    } catch (error) {
      console.error('error in get user trust score from node')
      console.log('error message: ', error.response.data.message)
      console.log('error details: ', error.response)
    }
  },

  getAddressesOfWallet: async wallet => {
    let [addressesToCheck, addressesThatExists, notExistsAddressFound] = wallet_addresses_inital_values;
    let NextChunk = wallet.getWalletAddresses().size;
    while (!notExistsAddressFound) {
      for (var i = NextChunk; i < NextChunk + 20; i++) {
        addressesToCheck.push(wallet.generateAddressByIndex(i).getAddressHex());
      }
      let addressesResult = await self.checkAddressExists(addressesToCheck);
      addressesThatExists = addressesThatExists.concat(Object.keys(addressesResult).filter(x => addressesResult[x] == true));
      notExistsAddressFound = Object.values(addressesResult).filter(val => val == false).length;
      addressesToCheck = [];
      NextChunk = NextChunk + 20;
    }
    return addressesThatExists
  },

  getTransactionsHistory: async addresses => {
    const distinctTransactions = new Map();
    const addressHexes = [...addresses.keys()]
    for (const addressHex of addressHexes) {
      let {data} = await axios.post(`${FULL_NODE_URL}/transaction/addressTransactions`,{address:addressHex});
      let {transactionsData} = data;

      transactionsData.forEach(transaction => {

        if(distinctTransactions.get(transaction.hash)) return;

        transaction.createTime = transaction.createTime * 1000;
        distinctTransactions.set(transaction.hash, transaction);

      });
    }

    return distinctTransactions;
  },

  checkAddressExists: async addressesToCheck => {
    try {
      const { data } = await axios.post(`${FULL_NODE_URL}/address`, { addresses: addressesToCheck });
      return data.addresses;
    } catch (err) {
      throw new Error(`Check addresses exists error: ${err}`);
    }
  },

  sendAddressToNode: async address => {
    
    try {
      const { data } = await axios.put(`${FULL_NODE_URL}/address`, { address: address.getAddressHex() });
      return data; 
    } catch (err) {
      throw new Error(`Error sending address to node: ${err}`);
    }
  },

  checkBalances: async addresses => {
    try {
      const { data } = await axios.post(`${FULL_NODE_URL}/balance`, { addresses });
      return data.addressesBalance;
    } catch (error) {
      throw new Error(`Check addresses balances error: ${error} for addresses:${addresses}`);
    }
  },

  sendTransaction: async ({wallet, transaction}) => {

    const userHash = wallet.generateUserPublicHash();

    const { amount, sourceAddresses, destinationAddress } = transaction;

    try {

      let baseTransactions = [];


      let totalPreBalance = new bigdecimal.BigDecimal(0);
      let amountToSend = new bigdecimal.BigDecimal(amount);
      for(let address of sourceAddresses) {
        let addressAmount = address[1].getPreBalance().compareTo(address[1].getBalance()) < 0 ? address[1].getPreBalance() : address[1].getBalance();
        if(addressAmount.toPlainString() <= 0) {
          continue;
        }

        let spendFromAddress = amountToSend.multiply(new bigdecimal.BigDecimal('-1'));
        bxTransaction = new BaseTransaction(address[1], spendFromAddress ,"IBT");
        baseTransactions.push(bxTransaction);
        totalPreBalance = totalPreBalance.add(addressAmount);

        let amountLeft = amount.subtract(addressAmount);
        if (amountLeft.compareTo(new bigdecimal.BigDecimal('0')) <= 0) {
          break;
        }

      }

      if(totalPreBalance.compareTo(new bigdecimal.BigDecimal(amount)) < 0) {
        return Promise.reject(new Error(`Send transaction Error - Not enough balance`));
      }

      const { fullNodeFee, networkFee } = self.createMiniConsenuse(userHash, amount);
      const amountRBB = new bigdecimal.BigDecimal(amount).subtract(new bigdecimal.BigDecimal(fullNodeFee.amount)).subtract(new bigdecimal.BigDecimal(networkFee.amount)).toString();

      const RBT = new BaseTransaction(destinationAddress, amountRBB, "RBT")
      const fullNodeTransactionFee = BaseTransaction.getBaseTransactionFromFeeObject(fullNodeFee);
      const transactionNerworkfee = BaseTransaction.getBaseTransactionFromFeeObject(networkFee);

      baseTransactions.push(fullNodeTransactionFee);
      baseTransactions.push(transactionNerworkfee);
      baseTransactions.push(RBT);

      let transactionToSend =  new Transaction(baseTransactions, description, userHash);

      const transactionTrustScoreData = await self.getTrustScoreFromTsNode(Wallet, userHash, transaction);
      transactionToSend.addTrustScoreMessageToTransaction(transactionTrustScoreData);

      const { data} = await axios.put(`${FULL_NODE_URL}/transaction`,transaction);

      return data;
    } catch (error) {
      console.log('Error sending transaction:', error)
    }
  },

  getFullNodeFees: async amountToTransfer => {
    try {
      const res = await axios.post(`${FULL_NODE_URL}/fee`, {"originalAmount" : amountToTransfer});
      return res.data.fullNodeFee;
    } catch (error) {
      console.log("Error getting full node fees: ", error)
    }

  },
  getNetworkFees: async (fullNodeFee, userHash) => {
    try {
      const res = await axios.post(`${TRUSTSCORE_URL}/networkFee`, { "fullNodeFeeData" : fullNodeFee , "userHash" : userHash});
      return res.data.networkFeeData;
    } catch (error) {
      console.log("Error getting network fees: ", error)
    }

  },

  getTrustScoreFromTsNode: async ({Wallet, userHash, transaction}) => {

    const createTrustScoreMessage = {
      userHash,
      transactionHash: transaction.createTransactionHash(),
      userSignature: Wallet.signMessage(transaction.createTransactionHash())
    }

    try {
      const res = await axios.post(`${TRUSTSCORE_URL}/transactiontrustscore`, createTrustScoreMessage);
      return res.data.transactionTrustScoreData;
    } catch (error) {
      console.log("Error getting trust score from ts node: ", error)
    }
  },

  createMiniConsenuse: async (userHash, amount) => { 
    const iteration = 3;
    const fullNodeFee = await self.getFullNodeFees(amount);
    const networkFee = await self.getNetworkFees(fullNodeFee);
    
    let validationNetworkFeeMessage = { 
      fullNodeFeeData : fullNodeFee,
      networkFeeData : networkFee, 
      userHash
    };
    let res;
    try {
      for (let i = 1; i < iteration; i++){
        res = await axios.post(`${TRUSTSCORE_URL}/networkFee`, validationNetworkFeeMessage);
        validationNetworkFeeMessage.networkFeeData = res.data.networkFeeData;
      }
    }catch(error){
      console.log("error: ", error);
    }
    
    return { fullNodeFee, networkFee: res.data.networkFeeData }
  }
}