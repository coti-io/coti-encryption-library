const FULL_NODE_WEBSOCKET_ACTION = '/websocket';
const FULL_NODE_URL = process.env.FULL_NODE_URL;
const socketUrl = FULL_NODE_URL + FULL_NODE_WEBSOCKET_ACTION;
const bigdecimal = require('bigdecimal');
const nodeCleanup = require('node-cleanup');
const Stomp = require('webstomp-client');
const SockJS = require('sockjs-client');

class WebSocketService {
  constructor() {
    this.balanceSubscriptions = new Map();
    this.transactionsSubscriptions = new Map();

    this._MonitoringProvider = null;
    this.Client = null;
    this.reconnectCounter = 0;
  }

  initSocketConnection(monitoringProvider, successCallback, reconnectFailedCallback){
    this.openWebSocketConnection(monitoringProvider, successCallback, reconnectFailedCallback);
  }

  closeSocketConnection(){
    this.addressesUnsubscribe();
    this.Client.disconnect();
  }

  async addressesUnsubscribe() {
    this.balanceSubscriptions.forEach( async (balanceSubscription) => await balanceSubscription.unsubscribe());
    this.transactionsSubscriptions.forEach ( async (transactionsSubscription) => await transactionsSubscription.unsubscribe());

  }

  openWebSocketConnection(monitoringProvider, successCallback, reconnectFailedCallback) {

    this._MonitoringProvider = monitoringProvider;
    const addrs = this._MonitoringProvider.getAddressHexes();
    let ws = new SockJS(socketUrl);
    this.Client = Stomp.over(ws);
    this.Client.debug = () => {};
    this.Client.connect({}, () => {
      console.info('Web socket client connected:');
      this.onConnected(addrs, successCallback);
    }, (error) => {
        console.log(error);
        this.addressesUnsubscribe();
        this.reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
    });

  }

  reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs) {
    let connected = false;

    let ws = new SockJS(socketUrl);
    this.Client = Stomp.over(ws);
    this.Client.connect({}, () => {
      console.info('Web socket client reconnected:');
      connected = true;
      this.onConnected(addrs, successCallback);
    }, () => {
      if (!connected && this.reconnectCounter <= 6) {
        console.log('Web socket trying to reconnect. Counter: ', this.reconnectCounter);
        this.reconnectCounter++;
        this.reconnect(socketUrl, successCallback, reconnectFailedCallback, addrs);
      } else {
        console.log('Web socket client reconnect unsuccessful');
        reconnectFailedCallback(this._MonitoringProvider);
      }
    });

  }

  onConnected(addrs, callback) {
    this.reconnectCounter = 0;
    if(!addrs) addrs = [];

    addrs.forEach(address => {
      this.connectToAddress(address);
    });

    this.continueToOnConnected(addrs);

    if(callback) return callback(this._MonitoringProvider);
  }

  continueToOnConnected(addresses) {
    console.log('Connected and monitoring addresses: ', addresses);
    console.log('BalanceSubscriptions: ', [...this.balanceSubscriptions.keys()]);
    console.log('TransactionsSubscriptions: ', [...this.transactionsSubscriptions.keys()]);
  }

  connectToAddress(addressHex) {

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
            this.setAddressWithBalance(balance === null ? 0 : balance, preBalance === null ? 0 : preBalance, address);
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

  setAddressWithBalance(addressBalance, addressPreBalance, address) {

    addressBalance = new bigdecimal.BigDecimal(`${addressBalance}`);
    addressPreBalance = new bigdecimal.BigDecimal(`${addressPreBalance}`);

    this._MonitoringProvider.setAddressWithBalance(address, addressBalance, addressPreBalance);

  }
}

module.exports = WebSocketService;
