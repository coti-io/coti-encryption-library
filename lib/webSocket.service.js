// var axios = require('axios');
const FULL_NODE_WEBSOCKET_ACTION = '/websocket';
const FULL_NODE_WEBSOCKET_SUBSCRIPTION_ACTION = '/topic/address/';
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const socketUrl = FULL_NODE_URL + FULL_NODE_WEBSOCKET_ACTION;
const bigdecimal = require('bigdecimal');
const nodeCleanup = require('node-cleanup');
const Stomp = require('webstomp-client');
const SockJS = require('sockjs-client');
const {checkBalances} = require('./walletUtils');
const propagationSubscriptions = new Map();
const balanceSubscriptions = new Map();
const transactionsSubscriptions = new Map();

let _Wallet;
let Client;

module.exports = {
    initSocketConnection: (wallet, callback) => openWebSocketConnection(wallet, callback),
    closeSocketConnection: () => {
      addressesUnsubscribe();
      Client.disconnect();
    }
}

nodeCleanup((exitCode, signal) => {
    addressesUnsubscribe();
});

const addressesUnsubscribe = async () => {
    propagationSubscriptions.forEach( async (propagationSubscription) => await propagationSubscription.unsubscribe());
    balanceSubscriptions.forEach( async (balanceSubscription) => await balanceSubscription.unsubscribe());
    transactionsSubscriptions.forEach ( async (transactionsSubscription) => await transactionsSubscription.unsubscribe());
    
}

const openWebSocketConnection = (wallet, callback) => {
  _Wallet = wallet;
  const addresses = _Wallet.getWalletAddressHexes();
  let ws = new SockJS(socketUrl);
  Client = Stomp.over(ws);
  Client.debug = () => {};
  Client.connect({}, () => {
    console.info("Connected:") 
    onConnected(addresses, callback)
  }, (error) => {
      console.log(error);
      addressesUnsubscribe();
      reconnect(socketUrl, successCallback, _Wallet.getWalletAddressHexes());
  });

}

const reconnect = (socketUrl, successCallback, addresses) => { 
  let connected = false;
  let reconnectCounter = 0;
  let reconInv = setInterval(() => {
    ws = new SockJS(socketUrl);
    Client = Stomp.over(ws);
    Client.connect({}, (frame) => {
      clearInterval(reconInv);
      connected = true;
      onConnected(addresses)
    }, () => {
      console.log('#reconnect: ', reconnectCounter)
      if (!connected) {
        reconnect(socketUrl, successCallback);
      }
      return reconnectCounter > 6 ? clearInterval(reconInv) : reconnectCounter ++;
    });
  }, 1000);
}

const onConnected = (addresses, callback) => {
  console.log('Connected and monitoring addresses: ', addresses);
  if(!addresses) addresses = [];

  addresses.forEach(address => {
    connectToAddress(address);
  });

  for (let i = addresses.length; i < addresses.length + 10; i++) {
    let addressHex = _Wallet.generateAddressByIndex(i).getAddressHex();
    addressPropagationSubscriber(addressHex);
  }
  console.log("propagationSubscriptions: ", [...propagationSubscriptions.keys()]);
  console.log("balanceSubscriptions: ", [...balanceSubscriptions.keys()]);
  console.log("transactionsSubscriptions: ", [...transactionsSubscriptions.keys()]);
  
  if(callback) callback(_Wallet);
}


const connectToAddress = addressHex => {

  if(!balanceSubscriptions.get(addressHex)) {
    
    let balanceSubscription = Client.subscribe(`/topic/${addressHex}`, async ({body}) => {
      try {
        body = JSON.parse(body);
        if(body.message == 'Balance Updated!'){
          const address = _Wallet.getWalletAddresses().get(body.addressHash);
          if(address === undefined) {
            const errorMsg = `Error - Address not found for addressHex: ${body.addressHash}`;
            console.log(errorMsg);
            throw new Error(errorMsg);
          }
          const { balance, preBalance } = body;
          setAddressWithBalance(balance === null ? 0 : balance, preBalance === null ? 0 : preBalance, address);
        }
      } catch (error) {
        console.log(error);
      };
    });

    balanceSubscriptions.set(addressHex,balanceSubscription);

  }

  if(!transactionsSubscriptions.get(addressHex)) {
  
    let transactionSubscription = Client.subscribe(`/topic/addressTransactions/${addressHex}`, async ({body}) => {
      try {
        body = JSON.parse(body);
        const { transactionData } = body;
        _Wallet.setTransaction(transactionData);

      } catch (error) {
        console.log(error);
      };
    });
    
    transactionsSubscriptions.set(addressHex, transactionSubscription);
  }

}

const addressPropagationSubscriber = addressHex => {
  let addressPropogationSubscription = Client.subscribe(`/topic/address/${addressHex}`, ({body}) => {
    try {
      body = JSON.parse(body);
      console.log('Received an address through address propagation:', body.addressHash);
      if(body.addressHash !== addressHex) throw new Error('Error in addressPropagationSubscriber');
      
      const subscription = propagationSubscriptions.get(addressHex);
      if(subscription) {
        subscription.unsubscribe();
        propagationSubscriptions.delete(addressHex);
        checkBalanceAndSubscribeNewAddress(addressHex)
        _Wallet.onGenerateAddress(addressHex);
      }
    } catch (err) {
      if(err){
        console.log("err: ", err);
      }
    }
  });
  propagationSubscriptions.set(addressHex, addressPropogationSubscription);
}

const checkBalanceAndSubscribeNewAddress = async (addressHex) => {
  
  const nextPropagationAddressHex = Array.from(propagationSubscriptions.keys()).pop() + 1;

  addressPropagationSubscriber(nextPropagationAddressHex);
  
  const address = _Wallet.getWalletAddresses().get(addressHex);
  if(!address) {
    const balances = await checkBalances([addressHex]);
    const { addressBalance, addressPreBalance } = balances[addressHex];
    setAddressWithBalance(addressBalance, addressPreBalance, address);
  }

  const addressIndex =  _Wallet.getWalletAddresses().get(addressHex).index;
  console.log(`subscribing the balance and transactions for address: ${addressHex} and index: ${addressIndex}`);
  connectToAddress(addressHex);
  
}

const setAddressWithBalance = (addressBalance, addressPreBalance, address) => {

  addressBalance = new bigdecimal.BigDecimal(`${addressBalance}`);
  addressPreBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);
  
  _Wallet.setAddressWithBalance(address, addressBalance, addressPreBalance);
  
}

