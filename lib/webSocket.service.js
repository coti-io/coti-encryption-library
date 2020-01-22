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
var addresses = require('./address');
const propagationSubscriptions = new Map();
const balanceSubscriptions = new Map();
const transactionsSubscriptions = new Map();

let _Wallet;
let Client;
let reconnectCounter = 0;

module.exports = {
    initSocketConnection: (wallet, successCallback, reconnectFailedCallback) => openWebSocketConnection(wallet, successCallback, reconnectFailedCallback),
    closeSocketConnection: () => {
      addressesUnsubscribe();
      Client.disconnect();
    },
    getSubscriptions: () => {
      return {
        propagationSubscriptions: propagationSubscriptions,
        balanceSubscriptions: balanceSubscriptions,
        transactionsSubscriptions: transactionsSubscriptions
      }
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

const openWebSocketConnection = (wallet, successCallback, reconnectFailedCallback) => {
  _Wallet = wallet;
  const addrs = _Wallet.getWalletAddressHexes();
  let ws = new SockJS(socketUrl);
  Client = Stomp.over(ws);
  Client.debug = () => {};
  Client.connect({}, () => {
    console.info("Web socket client connected:"); 
    onConnected(addrs, successCallback)
  }, (error) => {
      console.log(error);
      addressesUnsubscribe();
      reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
  });

}

const reconnect = (socketUrl, successCallback, reconnectFailedCallback, addrs) => { 
  let connected = false;
  
  ws = new SockJS(socketUrl);
  Client = Stomp.over(ws);
  Client.connect({}, (frame) => {
    console.info("Web socket client reconnected:")
    connected = true;
    onConnected(addrs, successCallback);
  }, () => {
    if (!connected && reconnectCounter <= 6) {
      console.log('Web socket trying to reconnect. Counter: ', reconnectCounter);
      reconnectCounter ++;
      reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
    } else {
      console.log('Web socket client reconnect unsuccessful');
      reconnectFailedCallback(_Wallet);
    }
  });
 
}

const onConnected = (addrs, callback) => {
  reconnectCounter = 0;
  console.log('Connected and monitoring addresses: ', addrs);
  if(!addrs) addrs = [];

  addrs.forEach(address => {
    connectToAddress(address);
  });

  for (let i = addrs.length; i < addrs.length + 10; i++) {
    const keyPair = _Wallet.getKeyPairFromAddressIndex(i);
    const address = new addresses.Address(keyPair, i);
    addressPropagationSubscriber(address);
  }
  console.log("propagationSubscriptions: ", [...propagationSubscriptions.keys()].map(a => a.getAddressHex()));
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
        transactionData.createTime = new Date(transactionData.createTime).getTime();
        if(transactionData.transactionConsensusUpdateTime) {
          transactionData.transactionConsensusUpdateTime = new Date(transactionData.transactionConsensusUpdateTime).getTime();
        }
        _Wallet.setTransaction(transactionData);

      } catch (error) {
        console.log(error);
      };
    });
    
    transactionsSubscriptions.set(addressHex, transactionSubscription);
  }

}

const addressPropagationSubscriber = address => {
  
  console.log('Subscribing for address:', address.getAddressHex());
  const alreadySubscribed = propagationSubscriptions.get(address);
  const addressHex = address.getAddressHex();
  if(alreadySubscribed) {
    sails.log.info('Attempting to resubscribe in address propogation, skip resubscription of:', address.getAddressHex());
  }

  let addressPropogationSubscription = Client.subscribe(`/topic/address/${addressHex}`, ({body}) => {
    try {
      body = JSON.parse(body);
      console.log('Received an address through address propagation:', body.addressHash, ' index:', address.index);
      if(body.addressHash !== addressHex) throw new Error('Error in addressPropagationSubscriber');
      
      const subscription = propagationSubscriptions.get(address);
      if(subscription) {
        subscription.unsubscribe();
        propagationSubscriptions.delete(address);
        checkBalanceAndSubscribeNewAddress(address)
        _Wallet.onGenerateAddress(addressHex);
      }
    } catch (err) {
      if(err){
        console.log("err: ", err);
      }
    }
  });
  propagationSubscriptions.set(address, addressPropogationSubscription);
}

const checkBalanceAndSubscribeNewAddress = async (address) => {
  
  const nextPropagationAddressIndex = Array.from(propagationSubscriptions.keys()).pop().index + 1;
  const keyPair = _Wallet.getKeyPairFromAddressIndex(nextPropagationAddressIndex);
  const nextAddress = new addresses.Address(keyPair, nextPropagationAddressIndex);


  addressPropagationSubscriber(nextAddress);
  
  const addressHex = address.getAddressHex();
  
  const balances = await checkBalances([addressHex]);
  const { addressBalance, addressPreBalance } = balances[addressHex];
  setAddressWithBalance(addressBalance, addressPreBalance, address);

  const addressIndex =  address.index;
  console.log(`subscribing the balance and transactions for address: ${addressHex} and index: ${addressIndex}`);
  connectToAddress(addressHex);
  
}

const setAddressWithBalance = (addressBalance, addressPreBalance, address) => {

  addressBalance = new bigdecimal.BigDecimal(`${addressBalance}`);
  addressPreBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);
  
  _Wallet.setAddressWithBalance(address, addressBalance, addressPreBalance);
  
}

