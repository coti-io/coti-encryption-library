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

  getAddressesOfWallet: async Wallet => {
    let [addressesToCheck, addressesThatExists, NextChunk, notExistsAddressFound] = wallet_addresses_inital_values;
    while (!notExistsAddressFound) {
      for (var i = NextChunk; i < NextChunk + 20; i++) {
        addressesToCheck.push(Wallet.generateAddressByIndex(i).getAddressHex());
      }
      let addressesResult = await self.checkAddressExists(addressesToCheck);
      addressesThatExists = addressesThatExists.concat(Object.keys(addressesResult).filter(x => addressesResult[x] == true));
      notExistsAddressFound = Object.values(addressesResult).filter(val => val == false).length;
      addressesToCheck = [];
      NextChunk = NextChunk + 20;
    }
    return addressesThatExists
  },

  checkAddressExists: async addressesToCheck => {
    try {
      const { data } = await axios.post(`${FULL_NODE_URL}/address`, { addresses: addressesToCheck });
      return data.addresses;
    } catch (err) {
      if (err) {
        console.log("HTTP: _Check address exists err: ", err.response);
      }
    }
  },

  checkBalances: async addresses => {
    try {
      const { data } = await axios.post(`${FULL_NODE_URL}/balance`, { addresses });
      return data.addressesBalance
    } catch (error) {
      console.log("Check addresses balances  error: ", error)
    }
  }
}