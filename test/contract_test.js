var solc = require('solc');
var Web3 = require('web3');

var fs = require('fs');
var assert = require('assert');
var BigNumber = require('bignumber.js');

// You must set this ENV VAR before testing
//assert.notEqual(typeof(process.env.ETH_NODE),'undefined');
var web3 = new Web3(new Web3.providers.HttpProvider(process.env.ETH_NODE));

var accounts;

var creator;
var escrow;
var buyer;
var buyer2;
var teamBonusAccount;

var initialBalanceCreator = 0;
var initialBalanceEscrow = 0;
var initialBalanceBuyer = 0;
var initialBalanceBuyer2 = 0;

var contractAddress;
var contract;

// init BigNumber
var unit = new BigNumber(Math.pow(10,18));

function diffWithGas(mustBe,diff){
     var gasFee = 15000000;
     return (diff>=mustBe) && (diff<=mustBe + gasFee);
}

function getContractAbi(contractName,cb){
     var file = './contracts/EthLendICO.sol';

     fs.readFile(file, function(err, result){
          assert.equal(err,null);

          var source = result.toString();
          assert.notEqual(source.length,0);

          var output = solc.compile(source, 1);   // 1 activates the optimiser
          var abi = JSON.parse(output.contracts[contractName].interface);
          return cb(null,abi);
     });
}

function deployContract(data,cb){
     var file = './contracts/EthLendICO.sol';
     var contractName = ':EthLendToken';

     fs.readFile(file, function(err, result){
          assert.equal(err,null);

          var source = result.toString();
          assert.notEqual(source.length,0);

          assert.equal(err,null);

          var output = solc.compile(source, 0); // 1 activates the optimiser

          //console.log('OUTPUT: ');
          //console.log(output.contracts);

          var abi = JSON.parse(output.contracts[contractName].interface);
          var bytecode = output.contracts[contractName].bytecode;
          var tempContract = web3.eth.contract(abi);

          var alreadyCalled = false;

          tempContract.new(
               creator,
               escrow,
               teamBonusAccount,
               {
                    from: creator, 
                    // should not exceed 5000000 for Kovan by default
                    gas: 4995000,
                    //gasPrice: 120000000000,
                    data: '0x' + bytecode
               }, 
               function(err, c){
                    assert.equal(err, null);

                    console.log('TX HASH: ');
                    console.log(c.transactionHash);

                    // TX can be processed in 1 minute or in 30 minutes...
                    // So we can not be sure on this -> result can be null.
                    web3.eth.getTransactionReceipt(c.transactionHash, function(err, result){
                         //console.log('RESULT: ');
                         //console.log(result);

                         assert.equal(err, null);
                         assert.notEqual(result, null);

                         contractAddress = result.contractAddress;
                         contract = web3.eth.contract(abi).at(contractAddress);

                         console.log('Contract address: ');
                         console.log(contractAddress);

                         if(!alreadyCalled){
                              alreadyCalled = true;

                              return cb(null);
                         }
                    });
               });
     });
}

describe('Contracts 0 - Deploy', function() {
     before("Initialize everything", function(done) {
          web3.eth.getAccounts(function(err, as) {
               if(err) {
                    done(err);
                    return;
               }

               accounts = as;
               creator = accounts[0];
               escrow = accounts[1];
               buyer = accounts[2];
               buyer2 = accounts[3];
               tokenBonusAccount = accounts[4];

               var contractName = ':EthLendToken';
               getContractAbi(contractName,function(err,abi){
                    ledgerAbi = abi;

                    done();
               });
          });
     });

     after("Deinitialize everything", function(done) {
          done();
     });

     it('should deploy token contract',function(done){
          var data = {};
          deployContract(data,function(err){
               assert.equal(err,null);

               done();
          });
     });

     it('should get initial balances',function(done){
          initialBalanceCreator = web3.eth.getBalance(creator);
          initialBalanceEscrow = web3.eth.getBalance(escrow);
          initialBalanceBuyer = web3.eth.getBalance(buyer);
          initialBalanceBuyer2 = web3.eth.getBalance(buyer2);

          done();
     });

     it('should get initial token balances',function(done){
          var balance = contract.balanceOf(creator);
          assert.equal(balance,0);

          balance = contract.balanceOf(escrow);
          assert.equal(balance,0);

          balance = contract.balanceOf(buyer);
          assert.equal(balance,0);

          balance = contract.balanceOf(teamBonusAccount);
          assert.equal(balance,300000000 * 1000000000000000000);

          done();
     });

     it('should get initial state',function(done){
          var state = contract.currentState();
          assert.equal(state,0);

          //enableTransfer should be false
          state = contract.enableTransfers();
          assert.equal(state,0);

          done();
     });

     it('should throw if state is INIT',function(done){
          // 0.2 ETH
          var amount = 200000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);

                    done();
               }
          );
     });

     it('should not move state if not owner',function(done){
          contract.setState(
               2,
               {
                    from: buyer,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     })

     it('should get token manager',function(done){
          var m = contract.tokenManager();
          assert.equal(m,creator);
          done();
     });

     it('should move state',function(done){
          contract.setState(
               2,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    console.log('Err:');
                    console.log(err);

                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);
                         done();
                    });
               }
          );
     })

     it('should be enableTransfer=false in PresaleRunning state',function(done){
          var state = contract.currentState();
          assert.equal(state,2);

          //enableTransfer should be false
          state = contract.enableTransfers();
          assert.equal(state,0);

          done();
     });

     it('should get updated state',function(done){
          var state = contract.currentState();
          assert.equal(state,2);
          done();
     })

     it('should not buy tokens if less than min',function(done){
          // 0.2 ETH
          var amount = 200000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should not buy tokens if less than min 2',function(done){
          // 0.9 ETH
          var amount = 900000000000000000;
          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);
                    done();
               }
          );
     });

     it('should buy tokens',function(done){
          // 1 ETH
          var amount = 1000000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         // 1 - tokens
                         var tokens = contract.balanceOf(buyer);
                         assert.equal(tokens,1000000000000000000 * 30000);

                         // 2 - ETHs
                         var currentBalance= web3.eth.getBalance(buyer);
                         var diff = initialBalanceBuyer - currentBalance;
                         var mustBe = 1000000000000000000;

                         assert.equal(diffWithGas(mustBe,diff),true);

                         done();
                    });
               }
          );
     });

// pause
     it('should pause',function(done){
          contract.setState(
               1,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         var state = contract.currentState();
                         assert.equal(state,1);

                         done();
                    });
               }
          );
     })

     it('should be enableTransfer=false in Paused state',function(done){
          var state = contract.currentState();
          assert.equal(state,1);

          //enableTransfer should be false
          state = contract.enableTransfers();
          assert.equal(state,0);

          done();
     });


     it('should throw if paused',function(done){
          // 1 ETH
          var amount = 1000000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);

                    done();
               }
          );
     });

     it('should un-pause',function(done){
          contract.setState(
               2,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         var state = contract.currentState();
                         assert.equal(state,2);

                         done();
                    });
               }
          );
     })

     /////// 
     it('should get updated Buyers balance',function(done){
          // 1 - tokens
          var tokens = contract.balanceOf(buyer);
          assert.equal(tokens / 1000000000000000000,30000);   

          // 2 - ETHs
          var currentBalance= web3.eth.getBalance(buyer);
          var diff = initialBalanceBuyer - currentBalance;
          var mustBe = 1000000000000000000;
          assert.equal(diffWithGas(mustBe,diff),true);

          done();
     });

     it('should move to Presale finished state',function(done){
          var state = contract.currentState();
          assert.equal(state,2);

          contract.setState(
               3,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         var state = contract.currentState();
                         assert.equal(state,3);

                         done();
                    });
               }
          );
     })

     it('should be enableTransfer=false in PresaleFinished state',function(done){
          var state = contract.currentState();
          assert.equal(state,3);

          //enableTransfer should be false
          state = contract.enableTransfers();
          assert.equal(state,0);

          done();
     });     

     it('should get price',function(done){
          var price = contract.getPrice();
          assert.equal(price,30000);
          done();
     })

     it('should get totalSupply',function(done){
          var total = contract.totalSupply();
          assert.equal(total / 1000000000000000000,(300000000 + 30000));   
          done();
     })

     it('should move to ICO is started state',function(done){
          var state = contract.currentState();
          assert.equal(state,3);

          contract.setState(
               4,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         var state = contract.currentState();
                         assert.equal(state,4);

                         done();
                    });
               }
          );
     })

     it('should be enableTransfer=false in ICORunning state',function(done){
          var state = contract.currentState();
          assert.equal(state,4);

          //enableTransfer should be false
          state = contract.enableTransfers();
          assert.equal(state,0);

          done();
     });     

     it('should get ICO price',function(done){
          var price = contract.getPrice();
          assert.equal(price,27500);
          done();
     })

     it('should buy tokens during ICO',function(done){
          // 1.5 ETH
          var amount = 1500000000000000000;

          web3.eth.sendTransaction(
               {
                    from: buyer2,               
                    to: contractAddress,
                    value: amount,
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         // 1 - tokens
                         var tokens = contract.balanceOf(buyer2);
                         assert.equal(tokens,1500000000000000000 * 27500);

                         // 2 - ETHs
                         var currentBalance= web3.eth.getBalance(buyer2);
                         var diff = initialBalanceBuyer2 - currentBalance;

                         assert.equal(diffWithGas(amount,diff),true);

                         done();
                    });
               }
          );
     })

     it('should move to ICOFinished state',function(done){
          var state = contract.currentState();
          assert.equal(state,4);

          contract.setState(
               5,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.equal(err,null);

                    web3.eth.getTransactionReceipt(result, function(err, r2){
                         assert.equal(err, null);

                         var state = contract.currentState();
                         assert.equal(state,5);

                         done();
                    });
               }
          );
     })

     it('should be enableTransfer=true in ICOFinished state',function(done){
          var state = contract.currentState();
          assert.equal(state,5);

          //enableTransfer should be false
          state = contract.enableTransfers();
          assert.equal(state,1);

          done();
     });  

     it('should not be able to change any state after ICOFinished',function(done){
          var state = contract.currentState();
          assert.equal(state,5); 

          //Trying to set Paused
          contract.setState(
               1,
               {
                    from: creator,               
                    gas: 2900000 
               },function(err,result){
                    assert.notEqual(err,null);

                    var state = contract.currentState();
                    assert.equal(state,5);

                    done();
               }
          );
     })
     ;
});


