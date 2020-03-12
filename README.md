
<p align="center"><img src="https://github.com/coti-io/coti-node/blob/dev/basenode/resources/logo-slogan-300x200.jpg"></p>

COTI encryption library
=============

[![GitHub Stars](https://img.shields.io/github/stars/coti-io/coti-encryption-library.svg)](https://github.com/coti-io/coti-encryption-library/stargazers)
[![GitHub Issues](https://img.shields.io/github/issues/coti-io/coti-encryption-library.svg)](https://github.com/coti-io/coti-encryption-library/issues)

---

## About this repository
```coti-encryption-library``` is the repository for COTI's library which is used to monitor desired COTI DAG data such as your wallet addresses/transactions and other non wallet addresses/transactions.

  :star: Star this repository to show your support!


---
## Table of Contents

- [Requirements](#requirements)
- [Install](#Install)
- [Usage](#Usage)
- [Support](#support)
- [License](#License)
---
## Requirements

* Node.JS

## Install

```
npm install coti-encryption-library
```

## Usage

add a ```SEED``` property in your configuration file.


```
const {Wallet, WalletWebSocketService, walletUtils  } = require('coti-encryption-library');
const { SEED } = process.env;


class WalletService extends MonitoringService {
    constructor(){
        this.wallet = new Wallet({ seed:SEED });
        this.walletWebSocketService = new WalletWebSocketService();
    }

    async monitorWallet() {

        this.wallet.enableEventPublishing();

        this.wallet.onGenerateAddress = data => {
            console.log('onGenerateAddress: ', data);
            IMPLEMENT LOGIC HERE...
        };

        this.wallet.onReceivedTransaction = async transaction => {
            console.log('onReceivedTransaction: ', transaction.hash);
            IMPLEMENT LOGIC HERE...
        };

        this.wallet.onBalanceChange = async address => {
            console.log('onBalanceChange: ', address.getAddressHex());
            IMPLEMENT LOGIC HERE...
        };

        this.wallet.onInitDone = async data => {
            console.log('onInitDone: ', data);
        };

        this.walletWebSocketService.initSocketConnection(this.wallet, this.onMonitoringInitialized, this.wsReconnectUnsuccesful);
    }
}
```

## Support

Don't hesitate to reach out to us at one of the following places:

- Email: <a href="https://coti.io/" target="_blank">`contact@coti.io`</a>
- Discord: <a href="https://discord.me/coti" target="_blank">`COTI Discord`</a>
- Telegram: <a href="https://t.me/COTInetwork" target="_blank">`COTInetwork`</a>

---
## License
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
This project is licensed under the terms of the **GNU General Public License v3.0** license.