const moment = require('moment');

module.exports = {
    getUtcInstant : function(){
      return moment.utc().valueOf() / 1000
    },
    getBytesFromString : function(str)
    {
        return str.split('').map(e => e.charCodeAt())
    },
    getStringFromUTF8Bytes : function (data)
    {
        var buff = new Buffer(data);
        return buff.toString('utf8');
    },
    hexToBytes : function(hex) {
        for (var bytes = [], c = 0; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
        return bytes;
    },
     byteArrayToHexString:  function(uint8arr) {
        if (!uint8arr) {
          return '';
        }
        
        var hexStr = '';
        for (var i = 0; i < uint8arr.length; i++) {
          var hex = (uint8arr[i] & 0xff).toString(16);
          hex = (hex.length === 1) ? '0' + hex : hex;
          hexStr += hex;
        } 
        return hexStr;
      }
}