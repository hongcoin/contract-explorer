var express = require('express');
var fs = require('fs');
var app = express();
var dateFormat = require('dateformat');

var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://127.0.0.1:8545'));

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');

var options = require('./options');
var favicon = require('serve-favicon');

var MyContract;
var myContractInstance;
var myContractInstanceAddress;


var mysql      = require('mysql');
var pool = mysql.createPool({
    host    : options.storageConfig.host,
    user    : options.storageConfig.user,
    password: options.storageConfig.password,
    database: options.storageConfig.database
});


var createContractRecord = function(address, contract_name, nickname, abiDefinition){
    var query = "INSERT INTO `contract` (`address`, `contract_name`, `nickname`, `abi_definition`, `creation_datetime`) VALUES (?, ?, ?, ?, now());";
    console.log(query);
    console.log([address, contract_name, nickname, abiDefinition]);

    pool.query(
        query, [address, contract_name, nickname, abiDefinition]
    , function(err, rows, fields) {
        if (err) throw err;
    });
}

var calculateQuorumPercentage = function(hong, quorum){
    var totalTokens = hong.tokensCreated().toNumber() + hong.bountyTokensCreated().toNumber();
    quorum = quorum.toNumber();

    return quorum / totalTokens * 100;
}


app.use(favicon(__dirname + '/public/images/favicon.ico'));



app.get('/', function(req, res){
    console.log('GET /')
    var query = "SELECT * FROM `contract` ";
    pool.query(query, function(err, rows){

        if(err)
            console.log("Error Selecting : %s ",err );

        res.render('home', {
            data: rows
        });
    });
});

app.get('/contract/', function(req, res){
    // redirect handler for contract form
    contract = req.query.contract;
    if(contract){
        res.writeHead(302, {
            'Location': '/c/' + contract
        });
        res.end();
    }else{
        contract = "";
        console.log('Missing contract parameter');
        res.writeHead(302, {
            'Location': '/'
        });
        res.end();
    }
});

app.get('/contract/watch', function(req, res){
    console.log('GET /')
    var html = fs.readFileSync('views/index.html');
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(html);
});


app.get('/c/:contract', function(req, res){
    // redirect handler for contract form
    var contract_address = req.params.contract;
    var contract_abi;
    var contract_obj;
    var contract_instance;

    // select info of the contract from database

    var query = "SELECT * FROM `contract` WHERE `address` = ? ";
    pool.query(query, [contract_address], function(err, rows){

        if(err)
            console.log("Error Selecting : %s ",err );

        if(rows.length == 0){
            res.writeHead(404, {});
            res.write('<html><head><title>Contract not found</title></head><body>');

            res.write("Contract " + contract_address + " does not exist.");
            res.write('</body></html>');
            res.end();
            return;
        }

        var result = rows[0];
        contract_abi = result.abi_definition;

        // collect info of contract from web3 api

        contract_obj = web3.eth.contract(JSON.parse(contract_abi));
        hong = contract_obj.at(contract_address);

        // total balance
        var contractBalance = web3.eth.getBalance(contract_address);
        var returnAccountBalance = web3.eth.getBalance(hong.ReturnAccount());
        var HONGRewardAccountBalance = web3.eth.getBalance(hong.HONGRewardAccount());
        var ManagementFeePoolWalletBalance = web3.eth.getBalance(hong.ManagementFeePoolWallet());
        var managementBodyAddressBalance = web3.eth.getBalance(hong.managementBodyAddress());
        var contractString = JSON.stringify(web3.eth.getStorageAt(contract_address));

        var totalContractBalance = web3.fromWei(contractBalance, "ether").toNumber()
                                 + web3.fromWei(hong.extraBalanceAccountBalance(), "ether").toNumber()
                                 + web3.fromWei(returnAccountBalance, "ether").toNumber()
                                 + web3.fromWei(HONGRewardAccountBalance, "ether").toNumber()
                                 + web3.fromWei(ManagementFeePoolWalletBalance, "ether").toNumber();

        // render HTML
        try {
            res.render('contract_home', {
                data: rows,
                block_number: web3.eth.blockNumber,
                totalContractBalance: totalContractBalance,
                contract: {
                    address: contract_address,
                    contractBalance: {
                        wei: contractBalance,
                        ether: web3.fromWei(contractBalance, "ether")
                    },

                    ReturnAccount: hong.ReturnAccount(),
                    returnAccountBalance: {
                        wei: returnAccountBalance,
                        ether: web3.fromWei(returnAccountBalance, "ether")
                    },

                    HONGRewardAccount: hong.HONGRewardAccount(),
                    HONGRewardAccountBalance: {
                        wei: HONGRewardAccountBalance,
                        ether: web3.fromWei(HONGRewardAccountBalance, "ether")
                    },

                    ManagementFeePoolWallet: hong.ManagementFeePoolWallet(),
                    ManagementFeePoolWalletBalance: {
                        wei: ManagementFeePoolWalletBalance,
                        ether: web3.fromWei(ManagementFeePoolWalletBalance, "ether")
                    },

                    managementBodyAddress: hong.managementBodyAddress(),
                    managementBodyAddressBalance: {
                        wei: managementBodyAddressBalance,
                        ether: web3.fromWei(managementBodyAddressBalance, "ether")
                    },

                    extraBalance: hong.extraBalance(),
                    extraBalanceBalance: {
                        wei: hong.extraBalanceAccountBalance(),
                        ether: web3.fromWei(hong.extraBalanceAccountBalance(), "ether")
                    },

                    currentTier: hong.getCurrentTier(),
                    tokensAvailableAtCurrentTier: hong.tokensAvailableAtCurrentTier(),
                    divisor: hong.divisor(),
                    extraBalanceAccountBalance: hong.extraBalanceAccountBalance(),
                    actualBalance: hong.actualBalance(),

                    tokensCreated: hong.tokensCreated(),
                    bountyTokensCreated: hong.bountyTokensCreated(),
                    totalTokensCreated: hong.tokensCreated().toNumber() + hong.bountyTokensCreated().toNumber(),

                    closingTime: hong.closingTime(),
                    closingTime_formatted: dateFormat(new Date(hong.closingTime() * 1000), "yyyy-mm-dd HH:MM:ss o"),
                    minTokensToCreate: hong.minTokensToCreate(),
                    maxTokensToCreate: hong.maxTokensToCreate(),
                    tokensPerTier: hong.tokensPerTier(),
                    weiPerInitialHONG: hong.weiPerInitialHONG(),
                    taxPaid: hong.taxPaid(),
                    isFundLocked: hong.isFundLocked(),
                    isFundReleased: hong.isFundReleased(),

                    isDayThirtyChecked: hong.isDayThirtyChecked(),
                    isDaySixtyChecked: hong.isDaySixtyChecked(),
                    currentFiscalYear: hong.currentFiscalYear(),
                    lastKickoffDate: hong.lastKickoffDate(),
                    lastKickoffDate_formatted: hong.lastKickoffDate()==0? "N/A": dateFormat(new Date(hong.lastKickoffDate() * 1000), "yyyy-mm-dd HH:MM:ss o"),
                    isKickoffEnabled_1: hong.isKickoffEnabled(1),
                    isKickoffEnabled_2: hong.isKickoffEnabled(2),
                    isKickoffEnabled_3: hong.isKickoffEnabled(3),
                    isKickoffEnabled_4: hong.isKickoffEnabled(4),
                    isInitialKickoffEnabled: hong.isInitialKickoffEnabled(),
                    isFreezeEnabled: hong.isFreezeEnabled(),
                    isHarvestEnabled: hong.isHarvestEnabled(),
                    isDistributionReady: hong.isDistributionReady(),
                    isDistributionInProgress: hong.isDistributionInProgress(),
                    votedFreeze: hong.votedFreeze(),
                    votedHarvest: hong.votedHarvest(),
                    returnCollected: hong.returnCollected(),
                    supportKickoffQuorum_1: hong.supportKickoffQuorum(1),
                    supportKickoffQuorum_2: hong.supportKickoffQuorum(2),
                    supportKickoffQuorum_3: hong.supportKickoffQuorum(3),
                    supportKickoffQuorum_4: hong.supportKickoffQuorum(4),
                    supportFreezeQuorum: hong.supportFreezeQuorum(),
                    supportHarvestQuorum: hong.supportHarvestQuorum(),
                    supportKickoffQuorumPercentage_1: calculateQuorumPercentage(hong, hong.supportKickoffQuorum(1)),
                    supportKickoffQuorumPercentage_2: calculateQuorumPercentage(hong, hong.supportKickoffQuorum(2)),
                    supportKickoffQuorumPercentage_3: calculateQuorumPercentage(hong, hong.supportKickoffQuorum(3)),
                    supportKickoffQuorumPercentage_4: calculateQuorumPercentage(hong, hong.supportKickoffQuorum(4)),
                    supportFreezeQuorumPercentage: calculateQuorumPercentage(hong, hong.supportFreezeQuorum()),
                    supportHarvestQuorumPercentage: calculateQuorumPercentage(hong, hong.supportHarvestQuorum()),
                    totalInitialBalance: hong.totalInitialBalance(),
                    annualManagementFee: hong.annualManagementFee(),
                    totalRewardToken: hong.totalRewardToken()
                }
            });
        } catch (err) {}

        res.write('<html><head><title>Contract not valid</title></head><body>');

        res.write("The system cannot process data of contract " + contract_address + " yet. This may be caused by change of HONG structure, or the contract is missing some functions.<br/><br/><a href='/'>Explore a new contract</a>");
        res.write('</body></html>');
        res.end();
    });
});


app.get('/server/status', function(req, res){
    console.log('GET /server/status')

    res.writeHead(200, {'Content-Type': 'application/json'});
    try{
        result = web3.eth.getBlock("0");

    }catch(err){
        console.log(err.message);
        console.log('Geth is OFFLINE');
        res.end(JSON.stringify({"status": "failed", "message": "GETH_OFFLINE"}));
        return;
    }

    // Block 0 in testnet has a difficulty of "131072"
    var is_testnet = (result.difficulty == "131072");

    res.end(JSON.stringify({"status": "success", "is_testnet": is_testnet}));
});




app.post('/createContract', function(req, res){
    console.log('POST /createContract');

    address = req.body.address;
    if(!address){
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": "failed", "message": "MISSING_PARAMETER", "details": "address"}));
        return
    }

    nickname = req.body.nickname;
    if(!nickname){
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": "failed", "message": "MISSING_PARAMETER", "details": "nickname"}));
        return
    }

    contract_name = req.body.contractName;
    if(!contract_name){
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": "failed", "message": "MISSING_PARAMETER", "details": "contractName"}));
        return
    }

    abiDefinition = req.body.abiDefinition;
    if(!abiDefinition){
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": "failed", "message": "MISSING_PARAMETER", "details": "abiDefinition"}));
        return
    }

    createContractRecord(address, contract_name, nickname, abiDefinition);

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({"status": "success", "message": ""}));
});


app.post('/compile/solidity', function(req, res){
    console.log('POST /compile/solidity')

    source_string = req.body.source_string
    if(!source_string){
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": "failed", "message": "MISSING_PARAMETER"}));
        return
    }
    try{
        result = web3.eth.compile.solidity(source_string)
    }catch(err){
        console.log(err.message)
        if(err.message.indexOf("Expected import directive or contract definition.") > -1){
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                "status": "failed",
                "message": "CONTRACT_INVALID",
                "details": "Expected import directive or contract definition."
            }));
        }else if(err.message.indexOf("solc: exit status") > -1){
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                "status": "failed",
                "message": "CONTRACT_INVALID",
                "details": err.message
            }));
        }else if(err.message.indexOf("Invalid JSON RPC response") > -1){
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                "status": "failed",
                "message": "CONTRACT_INVALID",
                "details": err.message
            }));
        }else{
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                "status": "failed",
                "message": "ETH_SERVER_CONNECTION_ERROR"
            }));
        }
        return;
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(result));
});




app.post('/', function(req, res){
    console.log('POST /');
    console.dir(req.body);
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('Thanks for trying, but nothing here :(');
});

app.get('*', function(req, res){
    console.log('Not found')
    res.writeHead(400, {'Content-Type': 'text/html'});
    res.end("Page not found");
});

port = 5100;
app.listen(port);
console.log('Listening at http://localhost:' + port)
