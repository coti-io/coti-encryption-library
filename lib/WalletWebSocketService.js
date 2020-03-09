const WebSocketService = require('./WebSocketService');
const {checkBalances} = require('./walletUtils');
const Address = require('./Address');

class WalletWebSocketService extends WebSocketService {
    constructor() {
        super();
        this.propagationSubscriptions = new Map();
    }

    async addressesUnsubscribe() {
        super.addressesUnsubscribe();
        this.propagationSubscriptions.forEach( async (propagationSubscription) => await propagationSubscription.unsubscribe());
    }

    continueToOnConnected(addresses) {

        super.continueToOnConnected();
        for (let i = addresses.length; i < addresses.length + 10; i++) {
            const keyPair = this._MonitoringProvider.getKeyPairFromAddressIndex(i);
            const address = new Address(keyPair, i);
            this.addressPropagationSubscriber(address);
        }

        console.log('PropagationSubscriptions: ', [...this.propagationSubscriptions.keys()].map(a => a.getAddressHex()));
    }

    addressPropagationSubscriber(address) {

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
              this.checkBalanceAndSubscribeNewAddress(address);
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

      async checkBalanceAndSubscribeNewAddress(address){

        const nextPropagationAddressIndex = Array.from(this.propagationSubscriptions.keys()).pop().index + 1;
        const keyPair = this._MonitoringProvider.getKeyPairFromAddressIndex(nextPropagationAddressIndex);
        const nextAddress = new Address(keyPair, nextPropagationAddressIndex);

        this.addressPropagationSubscriber(nextAddress);

        const addressHex = address.getAddressHex();

        const balances = await checkBalances([addressHex]);
        const { addressBalance, addressPreBalance } = balances[addressHex];
        this.setAddressWithBalance(addressBalance, addressPreBalance, address);

        const addressIndex =  address.index;
        console.log(`Subscribing the balance and transactions for address: ${addressHex} and index: ${addressIndex}`);
        this.connectToAddress(addressHex);

      }
}

module.exports = WalletWebSocketService;
