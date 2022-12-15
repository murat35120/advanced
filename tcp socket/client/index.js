const net = require('net');
const client = new net.Socket();
const port = 1000;
const host = '192.168.1.3';
client.connect(port, host, function() {
console.log('Connected');
client.write(Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x03, 0x84, 0x00, 0xFF, 0xF0]));
});
client.on('data', function(data) {
console.log('Server Says : ' + data);
});
client.on('close', function() {
console.log('Connection closed');
});
client.on('error', function() {
	console.log("error");
});