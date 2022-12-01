const net = require('net');
const port = 25000;
const host = '10.4.9.117';
const server = net.createServer();
server.listen(port, host, () => {
console.log('TCP Server is running on port ' + port + '.');
});
let num=0;
let sockets = [];

server.on('connection', function(sock) {
	let id=num++;
	console.log('CONNECTED: '+ id+ "  " + sock.remoteAddress + ':' + sock.remotePort);
	sockets[id]=sock;
	sock.write(Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x03, 0x84, 0x00, 0xFF, 0xF0]));
	sockets[id].on('data', function(data) {
		console.log('DATA from '+id+ "  " + sock.remoteAddress + ': ' + data);
	});
	// Add a 'close' event handler to this instance of socket
	sock.on('error', function(data) {
		console.log("error");
	});
	sock.on('close', function(data) {
		console.log("close");
		let index = sockets.findIndex(function(o) {
		return o.remoteAddress === sock.remoteAddress && o.remotePort === sock.remotePort;
	})
	if (index !== -1) sockets.splice(index, 1);
		console.log('CLOSED: ' + sock.remoteAddress + ' ' + sock.remotePort);
	});
});

function adv(){
	if(sockets[0]){
		sockets[0].write(Buffer.from([0xC8, 0x0D]));
		let timerId_1 = setTimeout(adv1, 1000);
	}
}

function adv1(){
	if(sockets[0]){
		sockets[0].write(Buffer.from([0x4C, 0x0D]));
	}
}

function send(){
	if(sockets[0]){
		sockets[0].write(Buffer.from([0x69, 0x0D]));
	}
}

//объект команды
//- ID конвертера conv_id
//- команда - тип (преобразуется в первый байт), последний байт ( 0x0D) вставляется автоматически.
//	0x1E - работа с лицензиями. lic
//	0x1F - работа с контроллерами. conv
//	0x20 - работа с конвертером. cont
//	...  другие имена
//	read

//- данные
//	номер лицензии
//	ID пакета
//	операция (команда)
//	адрес контроллера
//	параметры
//	дополнительные данные

//по имени операция (команда) можно определить и команда - тип.



let commands={
	full_info(data, obj, func){
		
	},
	base(data, obj, func){
		
	}
}


let timerId_0 = setTimeout(adv, 3000);
let timerId = setTimeout(send, 1000);
