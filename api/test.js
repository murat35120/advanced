let obj = {};
obj.queue=new Set(); //очередь
let step={params:1, func:2, back:3}; //элемент очереди
obj.queue.add(step); //добавили команду в очередь
step={params:4, func:5, back:6}; //элемент очереди
obj.queue.add(step); //добавили команду в очередь
obj.iterator = obj.queue[Symbol.iterator](); //создали итератор для очереди
let result = obj.iterator.next(); //
console.log('done - '+result.done );
console.log('value - '+result.value.params );
result = obj.iterator.next(); //
console.log('done - '+result.done );
console.log('value - '+result.value.params );
result = obj.iterator.next(); //
console.log('done - '+result.done );
//ok
let k={aa:0};
let m=10;
let s=3;
function *gen(k, m, s){
	k.aa=k.aa+m;
	yield "gen1"
	k.aa=k.aa+s;
	yield "gen2"
	k.aa++;
}
let asd=gen(k, m, s);
console.log('k - '+k.aa );
let qwe=asd.next();
console.log('value - '+qwe.value );
console.log('done - '+qwe.done );
console.log('k - '+k.aa );
qwe=asd.next();
console.log('value - '+qwe.value );
console.log('done - '+qwe.done );
console.log('k - '+k.aa );
qwe=asd.next();
console.log('done - '+qwe.done );
console.log('k - '+k.aa );
