const FULL_NODE_WEBSOCKET_ACTION = '/websocket';
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const socketUrl = FULL_NODE_URL + FULL_NODE_WEBSOCKET_ACTION;
const bigdecimal = require('bigdecimal');
const nodeCleanup = require('node-cleanup');
const Stomp = require('webstomp-client');
const SockJS = require('sockjs-client');
const {checkBalances} = require('./walletUtils');
const Address = require('./Address');
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
    }
};

nodeCleanup((exitCode, signal) => {
    console.log(`Exitcode: ${exitCode}, Signal: ${signal}`);
    addressesUnsubscribe();
});

async function addressesUnsubscribe() {
    propagationSubscriptions.forEach( async (propagationSubscription) => await propagationSubscription.unsubscribe());
    balanceSubscriptions.forEach( async (balanceSubscription) => await balanceSubscription.unsubscribe());
    transactionsSubscriptions.forEach ( async (transactionsSubscription) => await transactionsSubscription.unsubscribe());

}

function openWebSocketConnection(wallet, successCallback, reconnectFailedCallback) {
  _Wallet = wallet;
  const addrs = _Wallet.getWalletAddressHexes();
  let ws = new SockJS(socketUrl);
  Client = Stomp.over(ws);
  Client.debug = () => {};
  Client.connect({}, () => {
    console.info('Web socket client connected:');
    onConnected(addrs, successCallback);
  }, (error) => {
      console.log(error);
      addressesUnsubscribe();
      reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
  });

}

function reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs) {
  let connected = false;

  let ws = new SockJS(socketUrl);
  Client = Stomp.over(ws);
  Client.connect({}, () => {
    console.info('Web socket client reconnected:');
    connected = true;
    onConnected(addrs, successCallback);
  }, () => {
    if (!connected && reconnectCounter <= 6) {
      console.log('Web socket trying to reconnect. Counter: ', reconnectCounter);
      reconnectCounter++;
      reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
    } else {
      console.log('Web socket client reconnect unsuccessful');
      reconnectFailedCallback(_Wallet);
    }
  });

}

function onConnected(addrs, callback) {
  reconnectCounter = 0;
  console.log('Connected and monitoring addresses: ', addrs);
  if(!addrs) addrs = [];

  addrs.forEach(address => {
    connectToAddress(address);
  });

  for (let i = addrs.length; i < addrs.length + 10; i++) {
    const keyPair = _Wallet.getKeyPairFromAddressIndex(i);
    const address = new Address(keyPair, i);
    addressPropagationSubscriber(address);
  }
  console.log('PropagationSubscriptions: ', [...propagationSubscriptions.keys()].map(a => a.getAddressHex()));
  console.log('BalanceSubscriptions: ', [...balanceSubscriptions.keys()]);
  console.log('TransactionsSubscriptions: ', [...transactionsSubscriptions.keys()]);

  if(callback) return callback(_Wallet);
}


function connectToAddress(addressHex) {

  if(!balanceSubscriptions.get(addressHex)) {

    let balanceSubscription = Client.subscribe(`/topic/${addressHex}`, async ({body}) => {
      try {
        body = JSON.parse(body);
        if(body.message === 'Balance Updated!'){
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
      }
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
      }
    });

    transactionsSubscriptions.set(addressHex, transactionSubscription);
  }

}

function addressPropagationSubscriber(address) {

  console.log('Subscribing for address:', address.getAddressHex());
  const alreadySubscribed = propagationSubscriptions.get(address);
  const addressHex = address.getAddressHex();
  if(alreadySubscribed) {
    console.log('Attempting to resubscribe in address propagation, skip resubscription of:', address.getAddressHex());
  }

  let addressPropagationSubscription = Client.subscribe(`/topic/address/${addressHex}`, ({body}) => {
    try {
      body = JSON.parse(body);
      console.log('Received an address through address propagation:', body.addressHash, ' index:', address.index);
      if(body.addressHash !== addressHex) throw new Error('Error in addressPropagationSubscriber');

      const subscription = propagationSubscriptions.get(address);
      if(subscription) {
        subscription.unsubscribe();
        propagationSubscriptions.delete(address);
        checkBalanceAndSubscribeNewAddress(address);
        _Wallet.onGenerateAddress(addressHex);
      }
    } catch (err) {
      if(err){
        console.log('Error: ', err);
      }
    }
  });
  propagationSubscriptions.set(address, addressPropagationSubscription);
}

async function checkBalanceAndSubscribeNewAddress(address){

  const nextPropagationAddressIndex = Array.from(propagationSubscriptions.keys()).pop().index + 1;
  const keyPair = _Wallet.getKeyPairFromAddressIndex(nextPropagationAddressIndex);
  const nextAddress = new Address(keyPair, nextPropagationAddressIndex);


  addressPropagationSubscriber(nextAddress);

  const addressHex = address.getAddressHex();

  const balances = await checkBalances([addressHex]);
  const { addressBalance, addressPreBalance } = balances[addressHex];
  setAddressWithBalance(addressBalance, addressPreBalance, address);

  const addressIndex =  address.index;
  console.log(`Subscribing the balance and transactions for address: ${addressHex} and index: ${addressIndex}`);
  connectToAddress(addressHex);

}

function setAddressWithBalance(addressBalance, addressPreBalance, address) {

  addressBalance = new bigdecimal.BigDecimal(`${addressBalance}`);
  addressPreBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);

  _Wallet.setAddressWithBalance(address, addressBalance, addressPreBalance);

}

