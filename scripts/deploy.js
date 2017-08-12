var solc = require('solc');
var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

// You must set this ENV VAR before running 
assert.notEqual(typeof(process.env.ETH_NODE),'undefined');

var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

function getContractAbi(contractName,cb){
     var file = './contracts/EthLendICO.sol';

     fs.readFile(file, function(err, result){
          assert.equal(err,null);

          var source = result.toString();
          assert.notEqual(source.length,0);

          var output = solc.compile(source, 1);   // 1 activates the optimiser

          var abiJson = output.contracts[contractName].interface;

          var abi = JSON.parse(abiJson);
          var bytecode = output.contracts[contractName].bytecode;

          return cb(null,abi,bytecode,abiJson);
     });
}

// ************ READ THIS: ***********************
var creator = process.env.ETH_CREATOR_ADDRESS;

// 1 - get accounts
web3.eth.getAccounts(function(err, as) {
     if(err) {
          return;
     }

     // 2 - read ABI
     var contractName = ':EthLendToken';
     getContractAbi(contractName,function(err,abi,bytecode,abiJson){
          fs.writeFileSync('abi.out',abiJson);
          console.log('Wrote ABI to file: abi.out');

          //deployMain(creator,abi,bytecode);
     });
});

function deployMain(creator,abi,bytecode){
     var tempContract = web3.eth.contract(abi);

     // TODO: set these parameters!
     var tokenManager = 0;
     var escrow = 0;
     var teamBonus = 0;

     tempContract.new(
          tokenManager,
          escrow,
          teamBonus,
          {
               from: creator, 
               gas: 4995000,
               data: '0x' + bytecode 
          }, 
          function(err, c){
               if(err){
                    console.log('ERROR: ' + err);
                    return;
               }

               console.log('TX hash: ');
               console.log(c.transactionHash);
          });

}

