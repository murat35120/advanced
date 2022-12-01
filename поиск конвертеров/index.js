var PORT = 9000;
var BROADCAST_ADDR = "255.255.255.255";
var dgram = require('dgram');
var server = dgram.createSocket("udp4");

server.bind(function() {
    server.setBroadcast(true);
    setInterval(broadcastNew, 3000);
});

server.on('message', function (message, rinfo) {
    console.log('Message from: ' + rinfo.address + ':' + rinfo.port +' - ' + message);
});

function broadcastNew() {
    var message = Buffer.from("SEEK Z397IP");
    server.send(message, 0, message.length, PORT, BROADCAST_ADDR, function() {
        console.log("Sent '" + message + "'");
    });
}