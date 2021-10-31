/*
	Author: Zelenov Anton <tixset@gmail.com>
	GitHub: https://github.com/tixset/encryptionWebChat
*/
const soketHost = '185.98.86.127'; // Адрес сервера
const soketPort = 5555; // Порт сервера
const reConnectCount = 10; // Количество попыток переподключения
const reConnectTimeout = 3; // Интервал между попытками переподключения в секундах

var ws;
var mainName;
var mainRoom;
var mainKey;
var isConnect = false;
var isErr = false;
var reConnect = 0;
var countRoom = 0;
var newKeys = []; // Массив с полученными ключами
var sharedKey = 0;
var publicKey = 0;
var privateKey = 0;
var newKeySend = false;
var newKeySender = "";
var publicKeysCount = 0;
var sendKeysCount = 0;

function getRandStr() {
	return Math.random().toString(36).slice(-10);
}
function getRandInt(min, max) {
	return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min);
}
function wordEnding(num) {
	ch=num.substr(-1);
	if (((num.substr(-2) > 10) && (num.substr(-2) < 20)) || ((ch > 4) && (ch <= 9)) || (ch == 0)) return 3;
	if (ch == 1) return 1;
	if ((ch > 1) && (ch < 5)) return 2;
}
function escapeHtml(text) { // Убираем возможные теги из текста
	return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function getFormattedDate() {
	var date = new Date();
	var curMonth = date.getMonth() + 1;
	if (curMonth < 10) curMonth = '0' + curMonth;
	var curDate = date.getDate();
	if (curDate < 10) curDate = '0' + curDate;
	var curHours = date.getHours();
	if (curHours < 10) curHours = '0' + curHours;
	var curMinutes = date.getMinutes();
	if (curMinutes < 10) curMinutes = '0' + curMinutes;
	var curSeconds = date.getSeconds();
	if (curSeconds < 10)  curSeconds = '0' + curSeconds;
	return date.getFullYear() + "-" + curMonth + "-" + curDate + " " + curHours + ":" + curMinutes + ":" + curSeconds;
}
function code(text, key, decode) { // Алгоритм шифрования по Виженеру
	var sign;
	var result = "";
	if (!decode) text = decodeURIComponent(escape(window.atob(text)));
	if (key.length == 0) return;
	(decode) ? sign = -1 : sign = 1;
	for (let i = 0; i < text.length; i++) {
		result = result + String.fromCharCode(text[i].charCodeAt(0) + sign * key[i % key.length].charCodeAt(0));
	}
	if (decode) result = window.btoa(unescape(encodeURIComponent(result)));
	return result;
}
function clearKeys(ks = false) { // Очищаем переменные после обмена ключами
	sharedKey = 0;
	publicKey = 0;
	privateKey = 0;
	newKeySend = ks;
	newKeySender = "";
	publicKeysCount = 0;
	sendKeysCount = 0;
}
function get(id) {
	return document.getElementById(id);
}
function scroll() { // Прокрутка чата вниз
	get('chat').scrollTop = get('chat').scrollHeight;
}
function addToChat(mclass, text, cb = false) { // Добавление строки в чат
	(cb) ? cbText = "<div class='cb'></div>" : cbText = "";
	get('chat').innerHTML += "<div><div class='" + mclass + "'>" + text + "<div class='time'>" + getFormattedDate() + "</div></div></div>" + cbText;
}
window.onload = function() { // Функция выполняется после полной загрузки страницы
	// Генерируем имя и устанавливаем остальные параметры
	mainName = getRandStr(); 
	get('name').innerHTML = mainName;
	mainRoom = get('room').value;
	mainKey = get('key').value;
	// Фикс нажатия кнопки enter в чате на мобильных устройствах.
	var ta = get('text');
	var taVal = ta.value;
	var taLines = getLines(taVal);
	function getLines(str) {
		return (str.match(/[\n\r]/g) || []).length;
	}
	ta.addEventListener('input', function() {
		var newVal = ta.value;
		var newLines = getLines(newVal);
		if (newLines > taLines && newVal.length == taVal.length + 1) {
			send();
		}
		taVal = newVal;
		taLines = newLines;
	}, false);
}
function connect(reConn) {
	if (!reConn) {
		get('chat').innerHTML = "";
	}
	var protocol = window.location.protocol == 'https:' ? 'wss' : 'ws';
	ws = new WebSocket(protocol + "://" + soketHost + ":" + soketPort); // Подключаемся к серверу
	ws.onopen = function(evt) { // Успешно подключились
		addToChat('n', "Соединение установлено.");
		mainRoom = get('room').value;
		ws.send(mainRoom + ":enterRheRoom:" + mainName);
		isErr = false;
		isConnect = true;
		reConnect = 0;
	}
	ws.onmessage = function(evt) { // Получаем текст
	msg = evt.data.split(":");
		if (msg[1] == "enterRheRoom") { // Кто-то вошел в комнату
			if (msg[2] == mainName) {
				addToChat('n', "Вы вошли в чат, комната - " + mainRoom);
			} else {
				countRoom++;
				addToChat('w', "Пользователь " + '"' + msg[2] + '"' + " вошел в комнату - " + mainRoom);
			}
			scroll();
		}
		if (msg[1] == "exitTheRoom") { // Пользователь перешел в другую комнату
			if (msg[2] != mainName) {
				countRoom--;
				addToChat('w', "Пользователь " + '"' + msg[2] + '"' + " перешел в другую комнату.");
				scroll();
			}
		}
		if (msg[0] == "userCount") { // Сервер Говорит нам сколько сейчас пользователей в комнате
			countRoom = msg[1];
			let ending = wordEnding(countRoom);
			if (ending == 1) {
				word = "пользователь";
			}
			if (ending == 2) {
				word = "пользователя";
			}
			if (ending == 3) {
				word = "пользователей";
			}
			addToChat('w', "В комнате сейчас  " + countRoom + " " + word + ".");
			scroll();
		}
		if (msg[0] == "reAskUserCount") { 
			// Сервер просит нас переспросить у него количество пользователей в комнате
			// Cервер не знает кто конкретно отключился т.к. не хранит имена, но знает что количество пользователей в комнате уменьшилось на одного
			ws.send(mainRoom + ":getUserCount");
		}
		if (msg[1] == "sendMessage") { 
			// Входящее сообщение
			// Внутри сообщений мы так же обмениваемся ключами.
			// Это сделано специально, для того чтобы можно было несколько раз менять ключ и при этом остальные пользователи с дефолтным ключом, зашедшие в комнату позже, его не поймали
			var decodeText = code(msg[3], mainKey, false);
			var uc = decodeText.split(":");
			if (uc[0] == "updateKey") { // Если приходит чьё-то сообщение с общим ключом, то мы генерим и отправляем свой публичный ключ
				sharedKey = uc[1]; // Сохраняем общий ключ
				privateKey = getRandInt(1000, 9999); // Генерим приватный ключ
				publicKey = sharedKey + privateKey; // Вычисляем публичный ключ
				ws.send(mainRoom + ':sendMessage:' + mainName + ':' + code("publicKey:" + publicKey, mainKey, true)); // Отправляем публичный ключ
				if (!newKeySend) {
					newKeySender = msg[2]; // Записываем имя того кто отправил нам общий ключ, для того чтобы при получении публичных ключей знать каким ключом расшифровывать ключ шифрования.
				}
			} else {
				if (uc[0] == "publicKey") { // Получаем публичный ключ
					if (newKeySend) { // Если мы отправитель ключа шифрования
						publicKeysCount++;
						if (get('keys-' + sharedKey)) {
							get('keys-' + sharedKey).innerHTML = "Получение публичных ключей: " + publicKeysCount + "/" + countRoom; // Меняем значение в строке-счетчике
						}
						var encodeKey = code(newKeys[mainName], (Number(privateKey) + Number(uc[1])).toString(), true); // Зашифровываем новый ключ шифрования
						ws.send(mainRoom + ':sendMessage:' + mainName + ':' + code("newKey:" + msg[2] + ':' + encodeKey , mainKey, true)); // Отправляем новый ключ шифрования в зашифрованном виде
					} else { // Если НЕ мы отправитель ключа шифрования
						if (msg[2] == newKeySender) {
							// Если мы получили публичный ключ от того кто отправлял общий то записываем его 
							// Он понадобится при расшифровке ключа шифрования
							publicKey = uc[1]; 
						}
					}
				} else {
					if (uc[0] == "newKey") { // Получаем новый ключ шифрования в зашифрованном виде
						if (newKeySend) { // Если мы отправили ключ
							sendKeysCount++;
							if (sendKeysCount >= countRoom) { // Если получили ключей только же сколько пользователей в комнате, то применяем новый ключ у себя
								applyKey(mainName);
								scroll();
								clearKeys();
							}
						} else {
							if (uc[1] == mainName) {
								newKeys[msg[2]] = code(uc[2], (Number(privateKey) + Number(publicKey)).toString(), false); // Расшифровываем новый ключ шифрования и кладем его в массив
								clearKeys();
								addToChat('e', "Пользователь " + '"' + msg[2] + '"' + " предлогает обновить ключ шифрования: <a class='chat-button' href='javascript://' onclick='applyKey(" + '"' + msg[2] + '"' + ");return false;'>Принять</a>"); // Сообщаем пользователю о том что он может применить этот ключ
							}
						}
					} else { // Получаем сообщение
						decodeText = escapeHtml(decodeText).replaceAll(String.fromCharCode(10), '<br>');
						if (msg[2] == mainName) {
							addToChat('mt', "<b>Вы</b>: " + decodeText, true);
						} else {
							addToChat('mr', "<b>" + msg[2] + "</b>: " + decodeText, true);
						}
					}
				}
			}
			scroll();
		}
	}
	ws.onclose = function(evt) { // Это событие срабатывает не только при закрытии соединения сервером, но и при ошибке
		if (!isErr) {
			addToChat('e', "Сервер закрыл соединение.");
		}
		if (reConnect < reConnectCount) { // Пытаемся подключиться повторно
			reConnect++;
			addToChat('n', "Попытка подключения: #" + reConnect + "/" + reConnectCount);
			setTimeout("connect(true);", reConnectTimeout * 1000);
		} else {
			reConnect = 0;
		}
		scroll();
		isErr = false;
		isConnect = false;
	}
	ws.onerror = function(evt) { // При ошибке соединения с сервером
		isErr = true;
		if (reConnect < reConnectCount) {
			addToChat('e', "Ошибка соединения.");
		} else { // Если мы уже пробовали подключиться 10 раз, но так и не подключились
			addToChat('e', "Сервер возможно на техническом обслуживании. Приношу свои извинения за доставленные неудобства. <a class='chat-button' href='javascript://' onclick='connect(true);return false;'>Повторное подключение</a>");
		}
		scroll();
		isConnect = false;
	}
}
function changeName() { // Генерим новое имя, не сообщая ни кому об этом ))
	mainName = getRandStr();
	get('name').innerHTML = mainName;
}
function changeRoom() { // Переходим в другую комнату
	if (mainRoom != get('room').value) {
		var oldRoom = mainRoom;
		mainRoom = get('room').value;
		if (isConnect) {
			ws.send(oldRoom + ":exitTheRoom:" + mainName); // В предыдущую комнату отправляем сообщение о том что вышли из нее
			ws.send(mainRoom + ":enterRheRoom:" + mainName);
		}
	}
}
function changeKey() { // Действие по нажатию кнопки "Сменить ключ"
	if ((mainKey != get('key').value) && (isConnect)) { // Если ключ действительно новый и мы подключены к серверу
		if (confirm("Предложить этот ключ членам группы?")) { // Предлогаем наш ключ членам группы
			clearKeys(true);
			newKeys[mainName] = get('key').value; // Кладём наш ключ в массив
			sharedKey = getRandInt(1000, 9999); // Генерируем общий ключ
			addToChat('w', "<div class='keys' id='keys-" + sharedKey + "'>Получение публичных ключей: 0/" + countRoom + "</div>"); // Создаем в чате строку-счетчик
			ws.send(mainRoom + ':sendMessage:' + mainName + ':' + code("updateKey:" + sharedKey, mainKey, true)); // Разсылаем общий ключ
			setTimeout("applyKey(mainName);", 5000); // Если по какой-то причине втечении 5 секунд ответят не все клиенты, мы все равно применим наш ключ у себя
		} else { // Меняем только у себя
			mainKey = get('key').value;
			addToChat('w', "Ключ шифрования изменен.");
			scroll();
		}
	}
}
function randomKey() { // Генерация рандомного ключа шифрования
	get('key').value = getRandStr();
}
function applyKey(userName) { // Применяем новый ключ шифрования
	if (mainKey != newKeys[userName]) { // Если ключ действительно новый
		mainKey = newKeys[userName];
		get('key').value = mainKey;
		addToChat('w', "Ключ шифрования изменен.");
	}
}
function send() { // Отправка сообщений
	var room = get('room').value;
	var text = get('text').value;
	if (isConnect) {
		get('text').value = "";
		if ((text != "") && ((text.length != 1) && (text.charCodeAt(0) != 10))) { // Пустые сообщения не отправляем
			if (room != mainRoom) { // Если изменил комнату но не нажал соответствующую кнопку, то при отправке сообщения мы всеравно ее сменим ))
				ws.send(mainRoom + ":exitTheRoom:" + mainName); // В предыдущую комнату отправляем сообщение о том что вышли из нее
				mainRoom = room;
				ws.send(mainRoom + ":enterRheRoom:" + mainName);
			}
			ws.send(mainRoom + ':sendMessage:' + mainName + ':' + code(escapeHtml(text.trim()), mainKey, true)); // Отправляем зашифрованное сообщение
		}
	}
}