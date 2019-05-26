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
let subscriptions = [];
let _Wallet;
let Client;

module.exports = {
    initSocketConnection: (wallet, callback) => openWebSocketConnection(wallet, callback)
}

nodeCleanup((exitCode, signal) => {
    addressesUnsubscribe();
});

const addressesUnsubscribe = async () => {
    for (let addressSub of addressSubscriptions) {
        await addressSub.unsubscribe();
    }
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
      console.log(error)
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
      if (connected) {
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
    addressPropogationSubscriber(addressHex);
  }
  //console.log("subscriptions: ", subscriptions);
  
  if(callback) callback(_Wallet);
}


const connectToAddress = address => {

  let balanceSubscription = Client.subscribe(`/topic/${address}`, async ({body}) => {
    try {
      body = JSON.parse(body);
      if(body.message == 'Balance Updated!'){
        const addressIndex = _Wallet.getIndexByAddress(body.addressHash);
        setAddressWithBalance(body.balance, body.preBalance, addressIndex);
      }
    } catch (error) {
      console.log(error);
    };
  });

  subscriptions.push(balanceSubscription);
  
  let transactionSubscription = Client.subscribe(`/topic/addressTransactions/${address}`, async ({body}) => {
    try {
      body = JSON.parse(body);
      const { transactionData } = body;
      _Wallet.setTransaction(transactionData);

    } catch (error) {
      console.log(error);
    };
  });
  
  subscriptions.push(transactionSubscription);

}

const addressPropogationSubscriber = addressHex => {
  let addressPropogationSubscription = Client.subscribe(`/topic/address/${addressHex}`, ({body}) => {
    try {
      body = JSON.parse(body);
      addressSubscription(body.addressHash, addressPropogationSubscription);
      _Wallet.onGenerateAddress(body.addressHash);
    } catch (err) {
      if(err){
        console.log("err: ", err);
      }
    }
  });
  subscriptions.push(addressPropogationSubscription);
}
//Called only in propogation flow
const addressSubscription = (address, subscription) => {
  const walletAddressesList = _Wallet.getWalletAddresses();
  
  if(walletAddressesList.get(address)) {
    return;
  }
  
  if(subscription){
    subscription.unsubscribe()
    subscriptions = subscriptions.filter(s => s !== subscription);    
  }

  checkBalanceAndSubscribeNewAddress(address);
}

const checkBalanceAndSubscribeNewAddress = async (address) => {
  
  const addressesBalance = await checkBalances([address]);

  let { addressBalance, addressPreBalance } = addressesBalance[address];
  
  const nextAddressIndex = _Wallet.getWalletAddresses().size;
  
  const nextAddressPropogation = _Wallet.generateAddressByIndex( nextAddressIndex ).getAddressHex();
  
  setAddressWithBalance(addressBalance, addressPreBalance, nextAddressIndex);
  connectToAddress(address);
  addressPropogationSubscriber(nextAddressPropogation);

}

const setAddressWithBalance = (addressBalance, addressPreBalance, nextAddressIndex) => {

  addressBalance = new bigdecimal.BigDecimal(`${addressBalance}`);
  
  addressPreBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);
  
  const generatedAddress = _Wallet.generateAddressByIndex(nextAddressIndex);
  
  _Wallet.setAddressWithBalance(generatedAddress, addressBalance, addressPreBalance);
  
}

