#! /bin/bash

# Run this one in parallel:
#   node_modules/.bin/testrpc --port 8989 --gasLimit 10000000
# 
# In config.json: 
#    "test_node":"http://138.201.89.68:8545"
#    "test_node":"http://localhost:8989"

env ETH_NODE=http://localhost:8989 mocha --reporter spec -t 90000 -g "Contracts"

