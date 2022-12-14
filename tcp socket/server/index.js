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
		//send_file( res, first_url);
		console.log('get -'+ first_url);
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

let converters = {};

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
			obj.converter.lic_num=new Uint8Array([0x08]);
			obj.converter.obj=obj;
			obj.converter.cmd_id=new Uint8Array([0x00]);
			converters[obj.converter.model+"_"+obj.converter.number]= obj.converter;
			obj.cmd=commands.new_sock.read_lic;
			commands.read_lic(obj);
		},
		read_lic(obj){
			//console.log(obj.data);
			let ans=obj.data.subarray(1,obj.data.length-1);
			//console.log(ans);
			let tmp2=functions.in5out4(ans);
			//console.log(tmp2);
		},
		out(obj){
			//console.log("out");
			//console.log(converters.size);
		},
	},
	answer(data, obj){
		//console.log(String(data));
		obj.data=data;
		obj.cmd(obj); //заранее записана функция обработчик ответа
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
	read_lic_1(obj){
		let bstart=Buffer.from([0x01] );
		console.log("bstart - " + bstart);
		let bend=Buffer.from([0x0D] );		
		let buffer = Buffer.from([0x00, 0x00, 0x08, 0x01, 0x01, 0x08, 0x00, 0x00] );//краткое описание
		console.log("buffer - " + buffer);
		let tmp=functions.check_out(buffer);
		let tmp2=functions.in4out5(tmp);
		let tmp3=Buffer.from(tmp2);
		let tlength=bstart.length+tmp3.length+bend.length;
		console.log("tmp2 - " + tmp2);
		console.log("tmp2 - " + tmp3);
		console.log("tlength - " + tlength);
		let bfull=Buffer.concat([bstart, tmp3, bend], tlength);
		console.log("bful - " + bfull);
		obj.socket.write(bfull);
	},
	read_lic(obj){
		let bstart = new Uint8Array([0x1E]);  //создаем first
		let bend = new Uint8Array([0x0D]);  //создаем last	
		obj.converter.cmd_id++;
		let buffer = new Uint8Array([0x00, 0x00, obj.converter.lic_num, obj.converter.cmd_id, 0x01, 0x08, 0x00, 0x00] );//краткое описание
		let tmp=functions.check_out(buffer);
		let tmp2=functions.in4out5(tmp);
		let tlength=bstart.length+tmp2.length+bend.length;
		let bfull = new Uint8Array(tlength);
		bfull.set(bstart);
		bfull.set(tmp2,1);
		bfull.set(bend,11);
		//console.log("bful - " + bfull);
		obj.socket.write(bfull);
	},
	read_lic_api:{
		start(req, res, conv, lic_num, func){
			let obj=converters[conv].obj;
			obj.converter.lic_num=lic_num;
			obj.converter.cmd_id++;
			let buffer = new Uint8Array([0x1E, 0x00, 0x00, obj.converter.lic_num, obj.converter.cmd_id, 0x01, 0x08, 0x00, 0x00, 0x0D] );
			let tmp=functions.check_out(buffer.subarray(1,buffer.length-1));
			//console.log(tmp);
			let tmp2=functions.in4out5(tmp);
			//console.log(tmp2);
			let bfull = new Uint8Array([0x1E, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0D] );
			bfull.set(tmp2,1);
			//console.log("bful - " + bfull);
			obj.back=func;
			obj.cmd=commands.read_lic_api.end;
			obj.socket.write(bfull);
			obj.req=req;
			obj.res=res;
		},
		end(obj){
			let ans=obj.data.subarray(1,obj.data.length-1);
			//console.log(ans);
			let asd=functions.in5out4(ans);
			obj.ansver={controllers:asd[5],cards:(256*asd[7]+asd[6])};
			obj.back(obj);
		}
	},
	install_lic:{
		start(req, res, conv, lic_num, lic_text, func){
			let bfull = new Uint8Array(47);
			let obj=converters[conv].obj;
			let lic_full;
			if(!lic_text){
				lic_full = new Uint8Array([0x85,0x83,0x68,0xE4,0x03,0xCB,0xCE,0x35,0xC9,0x8D,0xC0,0x2B,0x62,0x96,0xCF,0x26,0x46,0x90,0x86,0x38,0xF6,0xE,0xC4,0xC5,0x19,0xC7]);
			} else{
				let i=0;
				let arr=[];
				while(i<lic_text.length){
					arr.push(Number("0x"+lic_text.slice(i,i+2)));
					i=i+2;
				}
				lic_full = new Uint8Array(arr);
			}	
			obj.converter.cmd_id++;
			let buffer = new Uint8Array([0x00, 0x00, obj.converter.lic_num, obj.converter.cmd_id, 0x02, obj.converter.lic_num, 0x00, 0x00] );
			let blast = new Uint8Array([0x00, 0x00] );
			bfull.set(buffer,1);
			bfull.set(lic_full,9);
			bfull.set(blast,35);
			let ttt=bfull.subarray(1,37);
			let tmp=functions.check_out(ttt);
			let tmp2=functions.in4out5(tmp);
			let bfull_1 = new Uint8Array([0x1E] );
			bfull.set(bfull_1,0);
			let bend = new Uint8Array([0x0D] );
			bfull.set(tmp2,1);
			bfull.set(bend,46);
			obj.back=func;
			obj.cmd=commands.install_lic.end;
			obj.socket.write(bfull);
			obj.req=req;
			obj.res=res;
		},
		end(obj){
			let ans=obj.data.subarray(1,obj.data.length-1);
			let asd=functions.in5out4(ans);
			obj.ansver={controllers:asd[5],cards:(256*asd[7]+asd[6])};
			obj.back(obj);
		}
	},
	controllers_list:{
		start(req, res, conv, lic_num, func){
			let obj=converters[conv].obj;	
			obj.converter.cmd_id++;
			let bfull = new Uint8Array([0x20, 0x00, 0x00, obj.converter.lic_num, obj.converter.cmd_id, 0x00, 0x00, 0x00, 0x00,  0x00, 0x00, 0x0D] );
			let ttt=bfull.subarray(1,9);
			//console.log(ttt.length);
			let tmp=functions.check_out(ttt);
			let tmp2=functions.in4out5(tmp);
			bfull.set(tmp2,1);
			//console.log(bfull);
			obj.back=func;
			obj.cmd=commands.controllers_list.end;
			obj.socket.write(bfull);
			obj.req=req;
			obj.res=res;
		},
		end(obj){
			let ans=obj.data.subarray(1,obj.data.length-1);
			let asd=functions.in5out4(ans);
			let tmp=asd.subarray(8,22);
			let tmp1=[];
			//console.log(asd.subarray(8,21).length);
			for(let i=0; i<tmp.length; i++){
				let sh= new Uint8Array([0x1]);
				let k;
				if(tmp[i]){
					for(let j=0; j<8; j++){
						k=tmp[i]&sh;
						if(k){
							tmp1.push(i*8+k+1);
						}
						sh=sh<<1;
					}
				}
			}
			obj.ansver=tmp1;
			obj.back(obj);
		}
	},
	controller_details:{
		start(req, res, conv, lic_num, controller_addr, func){
			let obj=converters[conv].obj;	
			obj.converter.cmd_id++;
			let bfull = new Uint8Array([0x20, 0x00, 0x00, obj.converter.lic_num, obj.converter.cmd_id, 0x00, controller_addr, 0x00, 0x00, 0x00, 0x00, 0x0D] );
			let ttt=bfull.subarray(1,9);
			//console.log(ttt.length);
			let tmp=functions.check_out(ttt);
			let tmp2=functions.in4out5(tmp);
			bfull.set(tmp2,1);
			//console.log(bfull);
			obj.back=func;
			obj.cmd=commands.controller_details.end;
			obj.socket.write(bfull);
			obj.req=req;
			obj.res=res;
		},
		end(obj){
			let ans=obj.data.subarray(1,obj.data.length-1);
			let asd=functions.in5out4(ans);
			//console.log(asd);
			let tmp1={};
			//console.log(asd.length);
			tmp1.type=asd[8];
			//tmp1.param=asd[9];
			tmp1.size=asd[9]&3;
			tmp1.x2=asd[9]>>2&1;
			tmp1.wiegand=asd[9]>>3&1;
			tmp1.join=asd[9]>>4&1;
			tmp1.p_rzvr=asd[9]>>5&1;
			tmp1.fv=asd[10]+"."+asd[11];
			tmp1.as=asd[13]+"."+asd[14];
			tmp1.rzvr=asd[12];
			tmp1.ar=asd[15]+"."+asd[16];
			obj.ansver=tmp1;
			obj.back(obj);
		}
	},
	open_door:{
		start(req, res, conv, lic_num, controller_addr, func){
			let obj=converters[conv].obj;	
			obj.converter.cmd_id++;
			let bfull = new Uint8Array([0x1F, 0x00, 0x00, obj.converter.lic_num, obj.converter.cmd_id, 0x07, controller_addr, 0x01, 0x00, 0x00, 0x00, 0x0D] );
			let ttt=bfull.subarray(1,9);
			//console.log(ttt.length);
			let tmp=functions.check_out(ttt);
			let tmp2=functions.in4out5(tmp);
			bfull.set(tmp2,1);
			//console.log(bfull);
			obj.back=func;
			obj.cmd=commands.open_door.end;
			obj.socket.write(bfull);
			obj.req=req;
			obj.res=res;
		},
		end(obj){
			let ans=obj.data.subarray(1,obj.data.length-1);
			let tmp1={};
			if(ans.length>5){
				let asd=functions.in5out4(ans);
				//console.log(asd);
				//console.log(asd.length);
				if(asd[8]==0x55){
					tmp1.result=1;
				}else{
					tmp1.result=0;
				}
				tmp1.repit=asd[9];
			}else{
				tmp1=String(ans);
				console.log(ans);
			}
			obj.ansver=tmp1;
			obj.back(obj);
		}
	}
}

let api={
	get_converters:{
		start(req, res, data, obj){
			//console.log(data.password);
			let asd=[];
			for(let key in converters){
			asd.push({key:key, mode:converters[key].mode, lic:converters[key].lic, addres:converters[key].obj.socket.remoteAddress}  );
			}
			functions.answer_send(res, asd);
		}
	},
	read_lic:{
		start(req, res, data, obj){
			commands.read_lic_api.start(req, res, data.conv,  data.lic_num, api.read_lic.end);
		},
		end(obj){
			functions.answer_send(obj.res, obj.ansver);
		}
	},	
	install_lic:{
		start(req, res, data, obj){
			commands.install_lic.start(req, res, data.conv,  data.lic_num, data.lic_text, api.install_lic.end);
		},
		end(obj){
			functions.answer_send(obj.res, obj.ansver);
		}
	},
	controllers_list:{
		start(req, res, data, obj){
			commands.controllers_list.start(req, res, data.conv,  data.lic_num, api.controllers_list.end);
		},
		end(obj){
			functions.answer_send(obj.res, obj.ansver);
		}
	},
	controller_details:{
		start(req, res, data, obj){
			commands.controller_details.start(req, res, data.conv,  data.lic_num, data.controller_addr, api.controller_details.end);
		},
		end(obj){
			functions.answer_send(obj.res, obj.ansver);
		}
	},
	open_door:{
		start(req, res, data, obj){
			commands.open_door.start(req, res, data.conv,  data.lic_num, data.controller_addr, api.open_door.end);
		},
		end(obj){
			functions.answer_send(obj.res, obj.ansver);
		}
	},
}

let functions={
	answer_send(res, msg){ // отправка сообщения API = HTTP сервер
		res.writeHead(200);
		if(typeof(msg)=="object"){
			res.end(JSON.stringify(msg));
			//console.log("send object");
		}else{
			res.end(msg);
			//console.log(msg);
		}
	},
	in4out5(buf_in){ //преобразование 4 в 5
		if( !(buf_in.byteLength % 4)){ //проверяем кратность 4
			let buffer = new ArrayBuffer(5*buf_in.byteLength/4)//расчитываем размер для out
			//let in_8 = new Uint8Array(buf_in);  //создаем out
			let in_8 = buf_in;
			let out_8 = new Uint8Array(buffer);  //создаем out
			let i=0;
			let k=0;
			while (i<in_8.length){
				out_8[k]=((in_8[i]&0x80)>>4)+((in_8[i+1]&0x80)>>5)+((in_8[i+2]&0x80)>>6)+((in_8[i+3]&0x80)>>7);
				for(let j=0;j<4;j++){
					out_8[k+j+1]=in_8[i+j]&0x7F;
				}
				for(let j=0;j<5;j++){
					if(out_8[k+j]<48){
						out_8[k+j]=out_8[k+j]^0xCA;
					}
				}
				i=i+4;
				k=k+5;
			}	
			return(out_8);
		}else{
			console.log("buf_in is not /4");
		}
	},
	in5out4(buf_in){ //преобразование 5 в 4
		if( !(buf_in.byteLength % 5)){ //проверяем кратность 5
			let buffer = new ArrayBuffer(4*buf_in.byteLength/5)//расчитываем размер для out
			let in_8 = new Uint8Array(buf_in);  //создаем out
			let out_8 = new Uint8Array(buffer);  //создаем out
			let i=0;
			let k=0;
			while (i<in_8.length){
				for(let j=0;j<5;j++){
					if(in_8[i+j]&0x80){
						in_8[i+j]=in_8[i+j]^0xCA;
					}
				}
				for(let j=0;j<4;j++){
					out_8[k+j]=in_8[i+j]|((( in_8[i+4]>>j)&1)<<7);
				}
				i=i+5;
				k=k+4;
			}	
			return(out_8);
		}else{
			console.log("buf_in is not /5");
		}
	},
	check_out(buffer){ //расчет длины и контрольной суммы на 00
		buffer[1]=buffer.byteLength;
		let c_summ=0;
		for(let i=0;i<buffer[1];i++){
			c_summ=c_summ+Number(buffer[i]);
		}
		let c_summ_b = c_summ&0xFF;
		buffer[0]=0x100-c_summ_b;
		return buffer;
	},
	check_in(buffer){ //расчет длины и контрольной суммы на FF
		buffer[1]=buffer.byteLength;
		let c_summ=0;
		for(let i=0;i<buffer[1];i++){
			c_summ=c_summ+Number(buffer[i]);
		}
		let c_summ_b = c_summ&0x0F;
		buffer[0]=0xFF-c_summ_b;
		return buffer;
	}
}

//let timerId_0 = setTimeout(adv, 8000);
//let timerId = setTimeout(send, 4000);
