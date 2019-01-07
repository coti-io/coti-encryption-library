

var axios = require('axios');
module.exports = {
    getAddressesOfWallet : async function(userWallet,fullNodeUrl)
    {
        var addressesToCheck =[];
        var notExistsAddressFound = false;
        var addressesThatExists = [];
        var NextChunk = 0;
        while (!notExistsAddressFound)
        {
            for (var i =NextChunk ; i< NextChunk + 20; i++)
            {
              addressesToCheck.push(userWallet.getAddressByIndex(i));
            }
        
        var addressesResult = await checkAddressExists(addressesToCheck.map( x=>x.getAddressHex()) , fullNodeUrl);
          notExistsAddressFound = (Object.keys(addressesResult.addresses).filter(x=>addressesResult.addresses[x] ==false)).length > 0 ;
      
          addressesToReturn = [...addressesToCheck]
          addressesToCheck =[];
          NextChunk = NextChunk + 20;
        }
        return addressesToReturn;
    }
}


async function checkAddressExists(addressHex, fullNodeUrl)
{
    let config = {
        headers: {
       'cache-control': 'no-cache',
       'Content-Type': 'application/json'
       }
     }

  var details = await axios.post(`${fullNodeUrl}/address`,JSON.stringify({"addresses" : addressHex}),config); 
  return details.data;

}