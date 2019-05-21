const required = (e) => { throw("Implement function!") };

const Iservices = obj => {

    Object.defineProperty(obj, 'onGenerateAddress', {
        value: required,
        writable: true
    });

    Object.defineProperty(obj, 'onBalanceChange', {
        value: required,
        writable: true
    });

    Object.defineProperty(obj, 'onReceivedTransaction', {
        value: required,
        writable: true
    });

}

module.exports = Iservices