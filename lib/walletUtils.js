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
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting user trust score, error: ${errorMessage}`);
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
    let data = await axios.post(`${FULL_NODE_URL}/transaction/addressTransactions/batch`,{addresses:addressHexes});
    
    let parsedData = data.data;
    if(typeof parsedData !== 'object') {
      parsedData = JSON.parse(parsedData.substring(0,data.data.length-2).concat(']'));
    }
    const transactionsData = parsedData;
    transactionsData.forEach(transaction => {

      if(distinctTransactions.get(transaction.hash)) return;

      transaction.createTime = transaction.createTime * 1000;
      distinctTransactions.set(transaction.hash, transaction);

    });

    return distinctTransactions;
  },

  checkAddressExists: async addressesToCheck => {
    try {
      const { data } = await axios.post(`${FULL_NODE_URL}/address`, { addresses: addressesToCheck });
      return data.addresses;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error checking existing addresses from fullnode: ${errorMessage}`);
    }
  },

  sendAddressToNode: async address => {
    
    try {
      const { data } = await axios.put(`${FULL_NODE_URL}/address`, { address: address.getAddressHex() });
      return data; 
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error sending address to fullnode: ${errorMessage}`);
    }
  },

  checkBalances: async addresses => {
    try {
      const { data } = await axios.post(`${FULL_NODE_URL}/balance`, { addresses });
      return data.addressesBalance;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error checking address balances from fullnode: ${errorMessage} for addresses: ${addresses}`);
    }
  },

  getFullNodeFees: async (Wallet, amountToTransfer) => {
    try {
      const userHash = Wallet.generateUserPublicHash();
      const userSignature = new Signature.FullnodeFeeSignatue(amountToTransfer).sign(Wallet);    
      const res = await axios.put(`${FULL_NODE_URL}/fee`, {"originalAmount" : amountToTransfer, userHash, userSignature});
      return res.data.fullNodeFee;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting full node fees: ${errorMessage} for amount: ${amountToTransfer}`);
    }

  },
  getNetworkFees: async (fullNodeFee, userHash) => {
    try {
      const res = await axios.put(`${TRUSTSCORE_URL}/networkFee`, { "fullNodeFeeData" : fullNodeFee , "userHash" : userHash});
      return res.data.networkFeeData;
    } catch (error) {
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting network fee: ${errorMessage}`);
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
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error getting trust score from trust score node: ${errorMessage}`);
    }
  },

  createMiniConsensus: async ({userHash, fullNodeFee, networkFee}) => { 
    const iteration = 3;
    
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
      const errorMessage = error.response && error.response.data ? error.response.data.message : error.message;
      throw new Error(`Error in createMiniConsensus: ${errorMessage}`);
    }
    
    return { fullNodeFee, networkFee: res.data.networkFeeData }
  }
}