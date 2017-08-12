pragma solidity ^0.4.4;

contract SafeMath {
     function safeMul(uint a, uint b) internal returns (uint) {
          uint c = a * b;
          assert(a == 0 || c / a == b);
          return c;
     }

     function safeSub(uint a, uint b) internal returns (uint) {
          assert(b <= a);
          return a - b;
     }

     function safeAdd(uint a, uint b) internal returns (uint) {
          uint c = a + b;
          assert(c>=a && c>=b);
          return c;
     }

     function assert(bool assertion) internal {
          if (!assertion) throw;
     }
}

// Standard token interface (ERC 20)
// https://github.com/ethereum/EIPs/issues/20
contract Token is SafeMath {
     // Functions:
     /// @return total amount of tokens
     function totalSupply() constant returns (uint256 supply) {}

     /// @param _owner The address from which the balance will be retrieved
     /// @return The balance
     function balanceOf(address _owner) constant returns (uint256 balance) {}

     /// @notice send `_value` token to `_to` from `msg.sender`
     /// @param _to The address of the recipient
     /// @param _value The amount of token to be transferred
     function transfer(address _to, uint256 _value) {}

     /// @notice send `_value` token to `_to` from `_from` on the condition it is approved by `_from`
     /// @param _from The address of the sender
     /// @param _to The address of the recipient
     /// @param _value The amount of token to be transferred
     /// @return Whether the transfer was successful or not
     function transferFrom(address _from, address _to, uint256 _value){}

     /// @notice `msg.sender` approves `_addr` to spend `_value` tokens
     /// @param _spender The address of the account able to transfer the tokens
     /// @param _value The amount of wei to be approved for transfer
     /// @return Whether the approval was successful or not
     function approve(address _spender, uint256 _value) returns (bool success) {}

     /// @param _owner The address of the account owning tokens
     /// @param _spender The address of the account able to transfer the tokens
     /// @return Amount of remaining tokens allowed to spent
     function allowance(address _owner, address _spender) constant returns (uint256 remaining) {}

     // Events:
     event Transfer(address indexed _from, address indexed _to, uint256 _value);
     event Approval(address indexed _owner, address indexed _spender, uint256 _value);
}

contract StdToken is Token {
     // Fields:
     mapping(address => uint256) balances;
     mapping (address => mapping (address => uint256)) allowed;
     uint public totalSupply = 0;

     // Functions:
     function transfer(address _to, uint256 _value) {
          if((balances[msg.sender] < _value) || (balances[_to] + _value <= balances[_to])) {
               throw;
          }

          balances[msg.sender] -= _value;
          balances[_to] += _value;
          Transfer(msg.sender, _to, _value);
     }

     function transferFrom(address _from, address _to, uint256 _value) {
          if((balances[_from] < _value) || 
               (allowed[_from][msg.sender] < _value) || 
               (balances[_to] + _value <= balances[_to])) 
          {
               throw;
          }

          balances[_to] += _value;
          balances[_from] -= _value;
          allowed[_from][msg.sender] -= _value;

          Transfer(_from, _to, _value);
     }

     function balanceOf(address _owner) constant returns (uint256 balance) {
          return balances[_owner];
     }

     function approve(address _spender, uint256 _value) returns (bool success) {
          allowed[msg.sender][_spender] = _value;
          Approval(msg.sender, _spender, _value);

          return true;
     }

     function allowance(address _owner, address _spender) constant returns (uint256 remaining) {
          return allowed[_owner][_spender];
     }

     modifier onlyPayloadSize(uint _size) {
          if(msg.data.length < _size + 4) {
               throw;
          }
          _;
     }
}

contract EthLendToken is StdToken
{
/// Fields:
    string public constant name = "EthLend Token";
    string public constant symbol = "LEND";
    uint public constant decimals = 18;

    // this includes DEVELOPERS_BONUS
    uint public constant TOTAL_SUPPLY = 1300000000 * (1 ether / 1 wei);
    uint public constant DEVELOPERS_BONUS = 300000000 * (1 ether / 1 wei);

    uint public constant PRESALE_PRICE = 30000;  // per 1 Ether
    uint public constant PRESALE_MAX_ETH = 2000;
    // 60 mln tokens sold during presale
    uint public constant PRESALE_TOKEN_SUPPLY_LIMIT = PRESALE_PRICE * PRESALE_MAX_ETH * (1 ether / 1 wei);

    uint public constant ICO_PRICE1 = 27500;     // per 1 Ether
    uint public constant ICO_PRICE2 = 26250;     // per 1 Ether
    uint public constant ICO_PRICE3 = 25000;     // per 1 Ether

    // 1bln - this includes presale tokens
    uint public constant TOTAL_SOLD_TOKEN_SUPPLY_LIMIT = 1000000000* (1 ether / 1 wei);

    enum State{
       Init,
       Paused,

       PresaleRunning,
       PresaleFinished,

       ICORunning,
       ICOFinished
    }

    State public currentState = State.Init;

    address public teamTokenBonus = 0;

    // Gathered funds can be withdrawn only to escrow's address.
    address public escrow = 0;

    // Token manager has exclusive priveleges to call administrative
    // functions on this contract.
    address public tokenManager = 0;

    uint public presaleSoldTokens = 0;
    uint public icoSoldTokens = 0;
    uint public totalSoldTokens = 0;

/// Modifiers:
    modifier onlyTokenManager()     { if(msg.sender != tokenManager) throw; _; }
    modifier onlyInState(State state){ if(state != currentState) throw; _; }

/// Events:
    event LogBuy(address indexed owner, uint value);
    event LogBurn(address indexed owner, uint value);
    event LogStateSwitch(State newState);

/// Functions:
    /// @dev Constructor
    /// @param _tokenManager Token manager address.
    function EthLendToken(address _tokenManager, address _escrow, address _teamTokenBonus) 
    {
        tokenManager = _tokenManager;
        teamTokenBonus = _teamTokenBonus;
        escrow = _escrow;

        // send team bonus immediately
        uint teamBonus = DEVELOPERS_BONUS;
        balances[_teamTokenBonus] += teamBonus;
        totalSupply += teamBonus;

        assert(PRESALE_TOKEN_SUPPLY_LIMIT==60000000 * (1 ether / 1 wei));
        assert(TOTAL_SOLD_TOKEN_SUPPLY_LIMIT==1000000000 * (1 ether / 1 wei));
    }

    function buyTokens(address _buyer) public payable
    {
        if(currentState!=State.PresaleRunning && currentState!=State.ICORunning)
        {
            throw;
        }

        if(currentState==State.PresaleRunning){
            return buyTokensPresale(_buyer);
        }else{
            return buyTokensICO(_buyer);
        }
    }

    function buyTokensPresale(address _buyer) public payable onlyInState(State.PresaleRunning)
    {
        // min - 1 ETH
        if(msg.value < (1 ether / 1 wei)) throw;
        uint newTokens = msg.value * PRESALE_PRICE;

        if(presaleSoldTokens + newTokens > PRESALE_TOKEN_SUPPLY_LIMIT) throw;

        balances[_buyer] += newTokens;
        totalSupply += newTokens;
        presaleSoldTokens+= newTokens;
        totalSoldTokens+= newTokens;

        LogBuy(_buyer, newTokens);
    }

    function buyTokensICO(address _buyer) public payable onlyInState(State.ICORunning)
    {
        // min - 0.01 ETH
        if(msg.value < ((1 ether / 1 wei) / 100)) throw;
        uint newTokens = msg.value * getPrice();

        if(totalSoldTokens + newTokens > TOTAL_SOLD_TOKEN_SUPPLY_LIMIT) throw;

        balances[_buyer] += newTokens;
        totalSupply += newTokens;
        icoSoldTokens+= newTokens;
        totalSoldTokens+= newTokens;

        LogBuy(_buyer, newTokens);
    }

    function setState(State _nextState) public onlyTokenManager
    {
        bool canSwitchState
             =  (currentState == State.Init && _nextState == State.PresaleRunning)
             || (currentState == State.PresaleRunning && _nextState == State.Paused)
             || (currentState == State.Paused && _nextState == State.PresaleRunning)
             || (currentState == State.PresaleRunning && _nextState == State.PresaleFinished)
             || (currentState == State.PresaleFinished && _nextState == State.PresaleRunning)

             || (currentState == State.PresaleFinished && _nextState == State.ICORunning)

             || (currentState == State.ICORunning && _nextState == State.Paused)
             || (currentState == State.Paused && _nextState == State.ICORunning)
             || (currentState == State.ICORunning && _nextState == State.ICOFinished)
             || (currentState == State.ICOFinished && _nextState == State.ICORunning)
        ;

        if(!canSwitchState) throw;

        currentState = _nextState;
        LogStateSwitch(_nextState);
    }

    function withdrawEther() public onlyTokenManager
    {
        if(this.balance > 0) 
        {
            if(!escrow.send(this.balance)) throw;
        }
    }

/// Setters/getters
    function setTokenManager(address _mgr) public onlyTokenManager
    {
        tokenManager = _mgr;
    }

    function getTokenManager()constant returns(address)
    {
        return tokenManager;
    }

    function getCurrentState()constant returns(State)
    {
        return currentState;
    }

    function getPrice()constant returns(uint)
    {
        if(currentState==State.ICORunning){
             if(icoSoldTokens<(200000000 * (1 ether / 1 wei))){
                  return ICO_PRICE1;
             }
             
             if(icoSoldTokens<(300000000 * (1 ether / 1 wei))){
                  return ICO_PRICE2;
             }

             return ICO_PRICE3;
        }else{
             return PRESALE_PRICE;
        }
    }

    function getTotalSupply()constant returns(uint)
    {
        return totalSupply;
    }


    // Default fallback function
    function() payable 
    {
        buyTokens(msg.sender);
    }
}
