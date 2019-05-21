// var encryptionUtils = require("../cryptoUtils");
// var assert = require('assert');


// describe('getKeyPairFromPrivate()', function () {
//     it('verify get key pair from private', function () {
//         var keyPair = encryptionUtils.generateKeyPair();
//         var privateKey = keyPair.getPrivate('hex');  
//         var keyPairFromPrivate = encryptionUtils.getKeyPairFromPrivate(privateKey);
//         var publicKey = keyPair.getPublic('hex');
//         assert.equal(publicKey,keyPairFromPrivate.getPublic('hex'));
//     });
//   });



// describe('orderGRange()', function () {
//     it('validate private key in order g range', function () {
//         var key = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFBAAEDCE6AF48A03BBFD25E8CD0364141";
//         assert.equal(encryptionUtils.verifyOrderOfPrivateKey(key),false);
//         var key = "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFBBAAEDCE6AF48A03BBFD25E8CD0364141";
//         assert.equal(encryptionUtils.verifyOrderOfPrivateKey(key),true);
//     });
//   });

//   describe('crc32Check()', function () {
//     it('check crc32', function () {
        
//         var checkSumHex = encryptionUtils.getCrc32("244b3b31d29b93fb1e69dd07277c070ec2768620297a0c7e46e27b8974189ef10739ef8efcd02e2c710c4405fa3cf5e49627a5704c8a9ee3547868fb6f3e9b8c");
//         assert.strictEqual(checkSumHex,"8ddafa95");
//     });
//   });


