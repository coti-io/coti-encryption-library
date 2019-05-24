'use strict';


var cotiCrypto = exports;
cotiCrypto.stringUtils = require('./stringUtils'),
cotiCrypto.cryptoUtils = require('./cryptoUtils'),
cotiCrypto.walletUtils = require('./walletUtils'),
cotiCrypto.walletEncryption = require('./walletEncryption'),
cotiCrypto.webSocketService = require('./webSocket.service'),
cotiCrypto.Transaction = require('./Transaction'),
cotiCrypto.addresses = require('./address'),
cotiCrypto.BaseTransaction = require('./BaseTransaction'),
cotiCrypto.Signature = require('./Signature')