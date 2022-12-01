const net = require('net');
const port = 25000;
const host = '10.4.9.117';
const server = net.createServer();
server.listen(port, host, () => {
console.log('TCP Server is running on port ' + port + '.');
});
let id_cv=0;
let sockets = [];//массив сокетов, вероятно он  уже не нужен
let converters = [];// массив конвертеров
//каждый конвертер жранит его параметры и ссылку на сокет
server.on('connection', function(sock) {
	//процесс подключения включает в себя: создание сокета, переход в адвансед, краткая информация о конвертере
	//заканчивается проверкойи если нет то созданием конвертера с последующей записью туда информации о нем 
	//и ссылки на сокет
	console.log('CONNECTED: ' + sock.remoteAddress + ':' + sock.remotePort);
	let count=0; //счетчик шагов, 3 штатная работа
	let obj={};//объект хранения собранных данных
	obj.sock=sock;
	//Для перевода конвертера в режим "ADVANCED" необходимо установить скорость линии 230400:
	sock.write(Buffer.from([0xFF, 0xFA, 0x2C, 0x01, 0x00, 0x03, 0x84, 0x00, 0xFF, 0xF0]));
	console.log("write");
	sock.on('data', function(data) {
		console.log("on");
		if(1){//если ответ есть
			console.log("count "+count);
			switch(count){
				case 3 : 
					commands.answer(sock, data, obj);
					break;
				case 2 : 
					obj.l_list=data;//сохранить список лицензий
					sock.write(Buffer.from([0xC8, 0x0D]));//список лицензий
					count=commands.add_convertor(sock, obj);
					break;
				case 1 : 
					obj.s_desc=data;//сохранить краткое описание
					sock.write(Buffer.from([0xC8, 0x0D]));//получить список лицензий
					count=2;
					break;
				case 0 : 
					sock.write(Buffer.from([0x4C, 0x0D]));//получить краткое описание
					count=1;
					break;
				default: 
					console.log("the is error");
					//закрываем сокет
					break;
			}
		}else{
			//тут закрываем сокет
			sock.resetAndDestroy();
			console.log("destroy");
			//sock.destroy([error]);
		}
	});
	sock.on('error', function(data) {
		console.log("error with "+data);
	});
	sock.on('close', function(data) {
		console.log('CLOSED: of '+ data );
	})
});

//sockets[0].socket.write(Buffer.from([0x69, 0x0D]));//полное описание


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
	add_convertor(sock, obj){
		//парсим данные
		//если модель существует и лицензия соответствует
		//проверяем существует ли в массиве такой конвертер 
		//да - активируем, ставим флаг активен
		//нет - создаем, и активируем
		return 3;
		//если нет, то закрываем сокет
	},
	answer(sock, data, obj){

	},

}

