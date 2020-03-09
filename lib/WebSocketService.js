const FULL_NODE_WEBSOCKET_ACTION = '/websocket';
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const socketUrl = FULL_NODE_URL + FULL_NODE_WEBSOCKET_ACTION;
const bigdecimal = require('bigdecimal');
const nodeCleanup = require('node-cleanup');
const Stomp = require('webstomp-client');
const SockJS = require('sockjs-client');
const {checkBalances} = require('./walletUtils');
const Address = require('./Address');
const Wallet = require('./Wallet');

class WebSocketService {
  constructor() {
    // this.propagationSubscriptions = new Map();
    // this.balanceSubscriptions = new Map();
    // this.transactionsSubscriptions = new Map();

    // this._MonitoringProvider = null;
    // this.Client = null;
    // this.reconnectCounter = 0;
  }

  initSocketConnection(monitoringProvider, successCallback, reconnectFailedCallback){
    openWebSocketConnection(monitoringProvider, successCallback, reconnectFailedCallback);
  }

  closeSocketConnection(){
    this.addressesUnsubscribe();
    this.Client.disconnect();
  }
}

module.exports = WebSocketService;

nodeCleanup((exitCode, signal) => {
    console.log(`Coti encryption library cleanup before exit. Exitcode: ${exitCode}, Signal: ${signal}`);
    addressesUnsubscribe();
});

async function addressesUnsubscribe() {
    this.propagationSubscriptions.forEach( async (propagationSubscription) => await propagationSubscription.unsubscribe());
    this.balanceSubscriptions.forEach( async (balanceSubscription) => await balanceSubscription.unsubscribe());
    this.transactionsSubscriptions.forEach ( async (transactionsSubscription) => await transactionsSubscription.unsubscribe());

}

function openWebSocketConnection(monitoringProvider, successCallback, reconnectFailedCallback) {
  this.propagationSubscriptions = new Map();
  this.balanceSubscriptions = new Map();
  this.transactionsSubscriptions = new Map();
  this.reconnectCounter = 0;

  this._MonitoringProvider = monitoringProvider;
  const addrs = this._MonitoringProvider.getAddressHexes();//.getWalletAddressHexes();
  let ws = new SockJS(socketUrl);
  this.Client = Stomp.over(ws);
  this.Client.debug = () => {};
  this.Client.connect({}, () => {
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
  this.Client = Stomp.over(ws);
  this.Client.connect({}, () => {
    console.info('Web socket client reconnected:');
    connected = true;
    onConnected(addrs, successCallback);
  }, () => {
    if (!connected && this.reconnectCounter <= 6) {
      console.log('Web socket trying to reconnect. Counter: ', this.reconnectCounter);
      this.reconnectCounter++;
      reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
    } else {
      console.log('Web socket client reconnect unsuccessful');
      reconnectFailedCallback(this._MonitoringProvider);
    }
  });

}

function onConnected(addrs, callback) {
  this.reconnectCounter = 0;
  console.log('Connected and monitoring addresses: ', addrs);
  if(!addrs) addrs = [];

  addrs.forEach(address => {
    connectToAddress(address);
  });

  if(this._MonitoringProvider instanceof Wallet){
    for (let i = addrs.length; i < addrs.length + 10; i++) {
      const keyPair = this._MonitoringProvider.getKeyPairFromAddressIndex(i);
      const address = new Address(keyPair, i);
      addressPropagationSubscriber(address);
    }
  }
  console.log('PropagationSubscriptions: ', [...this.propagationSubscriptions.keys()].map(a => a.getAddressHex()));
  console.log('BalanceSubscriptions: ', [...this.balanceSubscriptions.keys()]);
  console.log('TransactionsSubscriptions: ', [...this.transactionsSubscriptions.keys()]);

  if(callback) return callback(this._MonitoringProvider);
}


function connectToAddress(addressHex) {

  if(!this.balanceSubscriptions.get(addressHex)) {

    let balanceSubscription = this.Client.subscribe(`/topic/${addressHex}`, async ({body}) => {
      try {
        body = JSON.parse(body);
        if(body.message === 'Balance Updated!'){
          const address = this._MonitoringProvider.getAddresses().get(body.addressHash);//.getWalletAddresses().get(body.addressHash);
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

    this.balanceSubscriptions.set(addressHex,balanceSubscription);

  }

  if(!this.transactionsSubscriptions.get(addressHex)) {

    let transactionSubscription = this.Client.subscribe(`/topic/addressTransactions/${addressHex}`, async ({body}) => {
      try {
        body = JSON.parse(body);
        const { transactionData } = body;
        transactionData.createTime = new Date(transactionData.createTime).getTime();
        if(transactionData.transactionConsensusUpdateTime) {
          transactionData.transactionConsensusUpdateTime = new Date(transactionData.transactionConsensusUpdateTime).getTime();
        }
        this._MonitoringProvider.setTransaction(transactionData);

      } catch (error) {
        console.log(error);
      }
    });

    this.transactionsSubscriptions.set(addressHex, transactionSubscription);
  }

}

function addressPropagationSubscriber(address) {

  console.log('Subscribing for address:', address.getAddressHex());
  const alreadySubscribed = this.propagationSubscriptions.get(address);
  const addressHex = address.getAddressHex();
  if(alreadySubscribed) {
    console.log('Attempting to resubscribe in address propagation, skip resubscription of:', address.getAddressHex());
  }

  let addressPropagationSubscription = this.Client.subscribe(`/topic/address/${addressHex}`, ({body}) => {
    try {
      body = JSON.parse(body);
      console.log('Received an address through address propagation:', body.addressHash, ' index:', address.index);
      if(body.addressHash !== addressHex) throw new Error('Error in addressPropagationSubscriber');

      const subscription = this.propagationSubscriptions.get(address);
      if(subscription) {
        subscription.unsubscribe();
        this.propagationSubscriptions.delete(address);
        checkBalanceAndSubscribeNewAddress(address);
        this._MonitoringProvider.onGenerateAddress(addressHex);
      }
    } catch (err) {
      if(err){
        console.log('Error: ', err);
      }
    }
  });
  this.propagationSubscriptions.set(address, addressPropagationSubscription);
}

async function checkBalanceAndSubscribeNewAddress(address){

  const nextPropagationAddressIndex = Array.from(this.propagationSubscriptions.keys()).pop().index + 1;
  const keyPair = this._MonitoringProvider.getKeyPairFromAddressIndex(nextPropagationAddressIndex);
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

  this._MonitoringProvider.setAddressWithBalance(address, addressBalance, addressPreBalance);

}

