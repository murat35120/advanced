const http = require('http');
const fs = require('fs'); //работа с файлами
const path = require('path'); //работа с путями
const os = require('os');
const net = require('net');
const dgram = require('dgram');
const port = 25000;
const port_client=1000;
const port_http=8080;
const roles=["manager", "admin"];
const port_udp = 9000;
const broadcast_adr = "255.255.255.255";
const ip_adresses = os.networkInterfaces();

let host = '10.4.9.117';
for(const i in ip_adresses){ // получаем свой IP адрес для TCP, UDP и HTTP серверов
	for(const k in ip_adresses[i]){
		if(ip_adresses[i][k].family == 'IPv4'){
			if(ip_adresses[i][k].address!="127.0.0.1"){
				host=ip_adresses[i][k].address;
				console.log("HTTP Server running at http://" + host + ':' + port_http)
			}
		}
	}
}

//TCP  client, конвертеры в режиме сервер----------->>>----------------
function new_client(host_client){
	let client = new net.Socket();
	let obj={socket:client, cmd:commands.new_sock.short_info};
	client.connect(port_client, host_client, function() {
		//console.log('Connected TCP client' + client.address().address);
		client.write(Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x03, 0x84, 0x00, 0xFF, 0xF0]));
		commands.new_sock.start(obj);
	});
	client.on('data', function(data) {
		//console.log('from client ' + data);
		commands.answer(data, obj);
	});
	client.on('close', function() {
	console.log('Connection client closed');
	});
	client.on('error', function() {
		console.log("error client ");
	});
}
//----------------------------<<<------------------------------


//UDP server  поиск конвертеров -------------->>-----------------------
const server_udp = dgram.createSocket("udp4");
server_udp.bind(function() {
    server_udp.setBroadcast(true);
    setTimeout(broadcastNew, 3000);
});
server_udp.on('message', function (message, rinfo) {
	let msg={};
	msg.from=rinfo.address;
	let str=String(message);
	arr=str.split(' ');
	for(let i in arr){
		let k=arr[i].split(':');
		if(k.length>1){
			msg[k[0]]=k[1];
		}else{
			let ind=k[0].indexOf('SN');
			if(k[0].includes('SN')){
				msg.number=k[0].slice(ind+2); 
			}
		}
	}
	if((msg.L1_Port==port_client)||(msg.L2_Port==port_client)){
		if((msg.L1_Conn=='0.0.0.0')&&(msg.L2_Conn=='0.0.0.0')){
			//console.log(msg);
			new_client(msg.from);
		}
	}
});
function broadcastNew() {
    var message = Buffer.from("SEEK Z397IP");
    server_udp.send(message, 0, message.length, port_udp, broadcast_adr, function() {
        //console.log("Sent '" + message + "'");
    });
}
//-----------------------------------------------------------<<----------------------------

//TCP server,  конвертеры в режиме клиент -------------->>>-------
const server = net.createServer();
server.listen(port, host, () => {
console.log('TCP Server running at ' + host + ' port '+ port);
});

server.on('connection', function(sock) {
	let obj={socket:sock, data:""};
	obj.queue=new Set(); //очередь
	obj.stack=[]; //стэк
	obj.cmd_id=0;
	console.log('CONNECTED: ' + obj.socket.remoteAddress + ':' + obj.socket.remotePort);
	obj.socket.write(Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x03, 0x84, 0x00, 0xFF, 0xF0]));//Для перевода конвертера в режим "ADVANCED" необходимо установить скорость линии 230400:
	obj.socket.on('data', function(data) {
		obj.data=data;
		func_api.answer(obj);	
	});
	obj.socket.on('error', function(data) {
		console.log("error from ");
	});
	obj.socket.on('close', function(data) {
		console.log('CLOSED: of ' );
	});
	in_api.queue_add(obj, {}, in_api.new_sock);
	in_api.queue_add(obj, {}, in_api.read_lic);
	
});
//--------------<<<------------------------------------------------------


//HTTP сервер,  получаем команды API ---------->>>--------------
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
				if(data.command in out_api){
					if(data.conv){
						in_api.queue_add(converters[data.conv], {reg:req, res:res, data:data, obj:obj}, out_api[data.command]);
					}else{
						out_api[data.command](req, res, data, obj);
					}
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
//--------------<<<------------------------------------

let converters = {};
let controllers = {
};

let in_api={
	queue(obj){//шаг очереди = выполнение
		if(obj.queue.size){
			let result = obj.iterator.next(); //
			//console.log('result - '+result.done );
			if(result.done){//очередь завершена
				obj.queue.clear();
				obj.stack.pop(); //удаляем запись из стэка (удаляем указатель на очередь)
			} else{
				obj.func=result.value.func;
				obj.params=result.value.params;
				obj.stack.push(result.value.func(obj)); //добавляем функцию в стэк = создаем генератор
				obj.stack[obj.stack.length-1].next();//вызываем функцию
				clearTimeout(obj.tmr);//сбросили старый таймер
				obj.tmr= setTimeout(in_api.out, 500, obj);//новый таймер, если ответа не будет
			}
		}
	},
	queue_add(obj, params, func){
		//console.log('next' );
		let step={params:params, func:func}; //элемент очереди
		obj.queue.add(step); //добавили команду в очередь
		if(!obj.stack.length){
			//console.log('add_cmd ' );
			obj.iterator = obj.queue[Symbol.iterator](); //создали итератор для очереди
			obj.stack.push(obj.iterator); //добавили очередь в стэк, она всегда самая первая команда;
			in_api.queue(obj);
		}
	},
	out(obj){
		//console.log(obj.stack.length);
		obj.stack.pop(); //удаляем запись из стэка (удаляем указатель на предыдущий шаг)
		if(obj.stack.length>1){
			//console.log("run out");
			obj.stack[obj.stack.length-1].next();//вызываем функцию
		}else{
			in_api.queue(obj);
		}
	},
	add_stack(ob, funk){
		obj.stack.push(funk(obj)); //добавляем функцию в стэк
		obj.stack[obj.stack.length-1].next();//вызываем функцию
	},
	*new_sock(obj) {
		let timerId = setTimeout(()=>obj.stack[obj.stack.length-1].next(), 100);
		//console.log("start 1 ");
		yield "start";
		obj.socket.write(func_api.full_info());
		//console.log("start 2 ");
		yield "read full_info"
		obj.full_info=String(obj.data);
		obj.socket.write(func_api.short_info());
		//console.log("start 3 ");
		yield "read short_info"
		if(obj.data.length){//парсим информацию о конвертере
			let arr = String(obj.data).split(' ');
			obj.model=arr[0];
			if(arr[1].length){
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
		} else{
			obj.stack.pop(); //удаляем запись из стэка
			//тут должен быть повторный вызов стека
			return;
		}
		obj.socket.write(func_api.license_list());
		//console.log("start 4 ");
		yield "read license_list"
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
		obj.lic=lic;
		obj.lic_num=new Uint8Array([0x08]);
		//obj.stack.pop(); //удаляем запись из стэка
		let name=obj.model+"_"+obj.number;
		if( name in converters){
			converters[name]=obj;
		}else{
			if(name.includes("397")){
				//создаем декоратор
			}else{
				//создаем декоратор
			}
			converters[name]=obj; 
		}	
		console.log("new "+name);
		in_api.out(obj);
		yield "end"
	},
	*read_lic(obj){
		let bstart = new Uint8Array([0x1E]);  //создаем first
		let bend = new Uint8Array([0x0D]);  //создаем last	
		obj.cmd_id++;
		let buffer = new Uint8Array([0x00, 0x00, obj.lic_num, obj.cmd_id, 0x01, 0x08, 0x00, 0x00] );//краткое описание
		let tmp=func_api.check_out(buffer);
		let tmp2=func_api.in4out5(tmp);
		let tlength=bstart.length+tmp2.length+bend.length;
		let bfull = new Uint8Array(tlength);
		bfull.set(bstart);
		bfull.set(tmp2,1);
		bfull.set(bend,11);
		obj.socket.write(bfull);
		yield "read_lic"
		let ans=obj.data.subarray(1,obj.data.length-1);
		//console.log(ans);
		let asd=func_api.in5out4(ans);
		obj.ansver={controllers:asd[5],cards:(256*asd[7]+asd[6])};
		//obj.stack.pop(); //удаляем запись из стэка
		let name=obj.model+"_"+obj.number;
		//console.log("start  "+name);
		in_api.out(obj);
		yield "end"
	},
	*install_lic(obj){
		let bfull = new Uint8Array(47);
		let lic_full;
		if(!obj.lic_text){
			lic_full = new Uint8Array([0x85,0x83,0x68,0xE4,0x03,0xCB,0xCE,0x35,0xC9,0x8D,0xC0,0x2B,0x62,0x96,0xCF,0x26,0x46,0x90,0x86,0x38,0xF6,0xE,0xC4,0xC5,0x19,0xC7]);
		} else{
			let i=0;
			let arr=[];
			while(i<obj.lic_text.length){
				arr.push(Number("0x"+obj.lic_text.slice(i,i+2)));
				i=i+2;
			}
			lic_full = new Uint8Array(arr);
		}	
		obj.cmd_id++;
		let buffer = new Uint8Array([0x00, 0x00, obj.lic_num, obj.cmd_id, 0x02, obj.lic_num, 0x00, 0x00] );
		let blast = new Uint8Array([0x00, 0x00] );
		bfull.set(buffer,1);
		bfull.set(lic_full,9);
		bfull.set(blast,35);
		let ttt=bfull.subarray(1,37);
		let tmp=func_api.check_out(ttt);
		let tmp2=func_api.in4out5(tmp);
		let bfull_1 = new Uint8Array([0x1E] );
		bfull.set(bfull_1,0);
		let bend = new Uint8Array([0x0D] );
		bfull.set(tmp2,1);
		bfull.set(bend,46);
		obj.socket.write(bfull);
		yield "install_lic"
		let ans=obj.data.subarray(1,obj.data.length-1);
		let asd=func_api.in5out4(ans);
		obj.ansver={controllers:asd[5],cards:(256*asd[7]+asd[6])};
		in_api.out(obj);
		yield "end"
	},
	get_converters(){
		let asd=[];
		for(let key in converters){
			asd.push({key:key, mode:converters[key].mode, lic:converters[key].lic, addres:converters[key].socket.remoteAddress});
		}
		return asd;
	}
};
let out_api={
	get_converters(req, res, data, obj){
		func_api.answer_send(res, in_api.get_converters());
	},
	//команды работы с конвертером  запускаем через конвеер
	*read_lic(param){
		obj=converters[param.params.data.conv];
		in_api.add_stack(obj, in_api.read_lic);
		yield "read_lic"
		func_api.answer_send(obj.params.res, obj.ansver);
		yield "end"
	},	
	*install_lic(param){
		obj=converters[param.params.data.conv];
		obj.lic_num=param.params.data.lic_num;
		obj.lic_text=param.params.data.lic_text;
		in_api.add_stack(obj, in_api.install_lic);
		yield "install_lic"
		func_api.answer_send(obj.params.res, obj.ansver);
		yield "end"
	},
};
let func_api={
	full_info(){
		return Buffer.from([0x69, 0x0D]);//полное описание
	},	
	short_info(){
		return Buffer.from([0xC8, 0x0D]);//краткое описание
	},
	license_list(){
		return Buffer.from([0x4C, 0x0D]);//список лицензий
	},
	end(){
		console.log("end");
	},
	read_lic(obj){
			obj.cmd_id++;
			let buffer = new Uint8Array([0x1E, 0x00, 0x00, obj.lic_num, obj.cmd_id, 0x01, 0x08, 0x00, 0x00, 0x0D] );
			let temp0=buffer.subarray(1,buffer.length-1);
			let tmp=functions.check_out(temp0);
			let tmp2=functions.in4out5(tmp);
			buffer.set(tmp2,1);
		return buffer;//список лицензий
	},
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
	},
	answer(obj){
		obj.stack[obj.stack.length-1].next(); //заранее записана функция обработчик ответа
	},
};



