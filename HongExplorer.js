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
var connection = mysql.createConnection({
    host    : options.storageConfig.host,
    user    : options.storageConfig.user,
    password: options.storageConfig.password,
    database: options.storageConfig.database
});



var createContractRecord = function(address, nickname, abiDefinition){
    var query = "INSERT INTO `contract` (`address`, `nickname`, `abi_definition`, `creation_datetime` VALUES (?, ?, ?, now());";

    connection.query(
        query, [address, nickname, abiDefinition]
    , function(err, rows, fields) {
        if (err) throw err;
    });
}


app.use(favicon(__dirname + '/public/images/favicon.ico'));



app.get('/', function(req, res){
    console.log('GET /')
    var query = "SELECT * FROM `contract` ";
    connection.query(query, function(err, rows){

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
    contract = req.params.contract
    console.log(contract);
    res.write('<html><head></head><body>');
    res.write(contract);
    res.write('</body></html>');
    res.end();
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

    abiDefinition = req.body.abiDefinition;
    if(!abiDefinition){
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({"status": "failed", "message": "MISSING_PARAMETER", "details": "abiDefinition"}));
        return
    }

    createContractRecord(address, nickname, abiDefinition);

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
