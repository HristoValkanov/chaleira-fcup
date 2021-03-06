// install serial library : https://www.npmjs.com/package/serialport
const serialport = require("serialport");
const domain = require("./sensors");

const port = new serialport("COM4", {
    baudRate: 9600,
});

const Readline = serialport.parsers.Readline;
const parser = new Readline();
port.pipe(parser);

port.on('open', onPortOpen);
parser.on('data', onData);
port.on('close', onClose);
port.on('error', onError);
port.write('Hi mom!');

function onPortOpen() {
    console.log("port Open");
}

function onData(data) {
    console.log(data)
    domain.handleArduinoData(dataToObject(data));
}

function onClose() {
    console.log("port closed");
}

function onError() {
    console.log("Something went wrong in serial communication");
}

function dataToObject(data){
    let result = {};
    let variables = data.split(";");

    variables.forEach(
        function (variable) {
            let part = variable.split(":");
            result[part[0]] = part[1];
        }
    );

    return result;
}

let output = {
    debug: onData,
};

module.exports = output;