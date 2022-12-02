const net = require('net');
const port = 25000;
const host = '10.4.9.117';
const server = net.createServer();
server.listen(port, host, () => {
console.log('TCP Server is running on port ' + port + '.');
});
let id_cv=0;
let converters = [];

server.on('connection', function(sock) {
	//let id=num++;
	let obj={socket:sock, cmd:commands.new_sock.short_info};
	//sockets[id]=converter;
	console.log('CONNECTED: ' + obj.socket.remoteAddress + ':' + obj.socket.remotePort);
	//sockets[id].socket=sock;
	//Для перевода конвертера в режим "ADVANCED" необходимо установить скорость линии 230400:
	obj.socket.write(Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x03, 0x84, 0x00, 0xFF, 0xF0]));
	obj.socket.on('data', function(data) {
		commands.answer(data, obj);
	});
	obj.socket.on('error', function(data) {
		console.log("error from ");
	});
	obj.socket.on('close', function(data) {
		console.log('CLOSED: of ' );
		//sockets[id].socket.remoteAddress;
		//sockets[id].socket.remotePort;
	});
	commands.new_sock.start(obj);
});

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
	new_sock:{
		start(obj){
			obj.cmd=commands.new_sock.short_info;
			let lnk=obj;
			let timerId = setTimeout(tmr, 100);
			function tmr(){
				commands.new_sock.tmr(lnk);
			}
		},
		tmr(obj){
			obj.cmd=commands.new_sock.full_info;
			commands.full_info(obj);
		},
		full_info(obj){
			obj.full_info=String(obj.data);
			obj.cmd=commands.new_sock.short_info;
			commands.short_info(obj);		
		},
		short_info(obj){
			if(obj.data.length){
				let arr = String(obj.data).split(' ');
				obj.model=arr[0];
				if(arr[1].length){
					console.log(arr[1]);
					let arr1=arr[1].split(',');
					if(arr1[0]){
						obj.number=arr1[0].split(':')[1];
					}
					if(arr1[1]){
						obj.mode=arr1[1].split(':')[1];
					}
					if(arr1[2]){
						obj.key=arr1[2].split('\r')[0];
					}
				}
			}
			obj.cmd=commands.new_sock.license_list;
			commands.license_list(obj);		
		},
		license_list(obj){
			let arr = String(obj.data).split('LIC: ');
			let lic={};
			if(arr.length){
				for (i=0; i<arr.length; i++){
					if(arr[i].length){
						let ss=arr[i].split(' ');
						if(Number(ss[0])){
							lic.type=Number(ss[0]);
							lic.controllers=ss[1].split('/')[0].split('(')[1];
							lic.cards=ss[1].split('/')[1].split(')')[0];
							console.log(lic);
						}
					}
				}
			}
			obj.lic=lic;
			console.log('end');
		}
	},
	answer(data, obj){
		console.log(String(data));
		obj.data=data;
		obj.cmd(obj);
	},
	license_list(obj){
		let cmd_buf=Buffer.from([0x4C, 0x0D]);//список лицензий
		obj.socket.write(cmd_buf);	
	},
	full_info(obj){
		let cmd_buf=Buffer.from([0x69, 0x0D]);//полное описание
		obj.socket.write(cmd_buf);
	},
	short_info(obj){
		let cmd_buf=Buffer.from([0xC8, 0x0D]);//краткое описание
		obj.socket.write(cmd_buf);
	},
	
}


//let timerId_0 = setTimeout(adv, 8000);
//let timerId = setTimeout(send, 4000);
