const http = require('http');
const fs = require('fs'); //работа с файлами
const path = require('path'); //работа с путями
const os = require('os');
const net = require('net');
const port = 25000;
let host = '10.4.9.117';
const port_http=8080;
const roles=["manager", "admin"];

const ip_adresses = os.networkInterfaces();
for(const i in ip_adresses){
	for(const k in ip_adresses[i]){
		if(ip_adresses[i][k].family == 'IPv4'){
			if(ip_adresses[i][k].address!="127.0.0.1"){
				host=ip_adresses[i][k].address;
				console.log("HTTP Server running at http://" + host + ':' + port_http)
			}
		}
	}
}
const server = net.createServer();
server.listen(port, host, () => {
console.log('TCP Server running at ' + host + ' port '+ port);
});

const server_http = http.createServer((req, res) => {
    let first_url=req.url;
	if(req.method=='GET'){ // запросы страниц
		send_file( res, first_url);
	}
	if(req.method=='POST'){ // запросы API
		send_post(req, res);
	}
}); 
server_http.listen(port_http);

function send_post(req, res){
    let body = [];
    req.on('error', function(err) {
        console.error(err);
    }).on('data', function(chunk) {
        body.push(chunk);
    }).on('end', function() {
        body = Buffer.concat(body).toString();
        try {
            let obj={}; 
			let data = JSON.parse(body);
			obj.role=path.basename(req.url);
			if(roles.includes(obj.role)){
				if(data.command in api){
					api[data.command].start(req, res, data, obj);
				}else{
					functions.answer_send(res, "no the command");
				}
			}else{
				functions.answer_send(res, "no the role");
			}	
        } catch (e) {
            console.error(e);
        }
        res.on('error', function(err) {
            console.error(err);
        });
    });	
}

let converters = new Map();

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
			let timerId = setTimeout(commands.new_sock.tmr, 100, obj);
		},
		tmr(obj){
			obj.tmr= setTimeout(commands.new_sock.out, 1000, obj);
			obj.cmd=commands.new_sock.full_info;
			commands.full_info(obj);
		},
		full_info(obj){
			clearTimeout(obj.tmr);
			obj.tmr= setTimeout(commands.new_sock.out, 1000, obj);
			function out(){commands.new_sock.out(obj);}
			obj.converter={};
			obj.converter.full_info=String(obj.data);
			obj.cmd=commands.new_sock.short_info;
			commands.short_info(obj);		
		},
		short_info(obj){
			clearTimeout(obj.tmr);
			obj.tmr= setTimeout(commands.new_sock.out, 1000, obj);
			function out(){commands.new_sock.out(obj);}
			if(obj.data.length){
				let arr = String(obj.data).split(' ');
				obj.converter.model=arr[0];
				if(arr[1].length){
					let arr1=arr[1].split(',');
					if(arr1[0]){
						obj.converter.number=arr1[0].split(':')[1];
					}
					if(arr1[1]){
						obj.converter.mode=arr1[1].split(':')[1];
					}
					if(arr1[2]){
						obj.converter.key=arr1[2].split('\r')[0];
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
						}
					}
				}
			}
			obj.converter.lic=lic;
			obj.converter.obj=obj;
			converters.set(obj.converter.model+obj.converter.number, obj.converter)
			
		},
		out(obj){
			//console.log("out");
			//console.log(converters.size);
		},
	},
	answer(data, obj){
		//console.log(String(data));
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

let api={
	get_converters:{
		start(req, res, data, obj){
			console.log(data.password);
			let asd=String(converters.size);
			console.log(asd);
			functions.answer_send(res, asd);
		}
	},	
}

let functions={
	answer_send(res, msg){ // 2_
		res.writeHead(200);
		if(typeof(msg)=="object"){
			res.end(JSON.stringify(msg));
			//console.log("send object");
		}else{
			res.end(msg);
			//console.log(msg);
		}
	},
}

//let timerId_0 = setTimeout(adv, 8000);
//let timerId = setTimeout(send, 4000);
