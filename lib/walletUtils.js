const axios = require('axios');
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const TRUSTSCORE_URL = process.env.TRUSTSCORE_URL;
const wallet_addresses_inital_values = [ [], [], 0, false ];
const Signature = require('./Signature');

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
    let [addressesToCheck, addressesThatExists, NextChunk, notExistsAddressFound] = wallet_addresses_inital_values;
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

  getTransactionsHistory: async addressHexes => {
    const distinctTransactions = new Map();
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

  getFullNodeFees: async (Wallet, amountToTransfer) => {
    try {
      const userHash = Wallet.generateUserPublicHash();
      const userSignature = new Signature.FullnodeFeeSignatue(amountToTransfer).sign(Wallet);    
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