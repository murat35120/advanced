var PORT = 9000;
var BROADCAST_ADDR = "255.255.255.255";
var dgram = require('dgram');
var server = dgram.createSocket("udp4");

server.bind(function() {
    server.setBroadcast(true);
    setInterval(broadcastNew, 3000);
});

server.on('message', function (message, rinfo) {
	let msg={};
	msg.from=rinfo.address;
	let str=String(message);
	arr=str.split(' ');
	for(let i in arr){
		let k=arr[i].split(':');
		if(k.length>1){
			msg[k[0]]=k[1];
		}else{
			//console.log(k);
			//console.log(k[0]);
			let ind=k[0].indexOf('SN');
			//console.log(ind);
			if(k[0].includes('SN')){
				msg.number=k[0].slice(ind+2); 
			}
		}
	}
    //console.log('Message from: ' + rinfo.address + ':' + rinfo.port +' - ' + message);
	console.log(msg);
});

function broadcastNew() {
    var message = Buffer.from("SEEK Z397IP");
    server.send(message, 0, message.length, PORT, BROADCAST_ADDR, function() {
        console.log("Sent '" + message + "'");
    });
}

let df={
  from: '192.168.1.3',
  'Z397-WEB-SW': '3.0.48',
  number: '33922',
  L1_Port: '25000',
  L2_Port: '0',
  L1_Conn: '192.168.1.2',
  L2_Conn: '0.0.0.0',
  Lock: '1'
}