const TeleBot = require('telebot');
const bot = new TeleBot('');
const checker = require('./service_monitor.js');
const fs = require("fs");
var util = require('util');

var monitors = require("./monitors.json");

var userSessions = {};

var wizardPrompts = {};
wizardPrompts['waitingURL'] = `Me passe a URL do serviço que você gostaria de monitorar. Não esqueça de por http:// ou https:// na frente.`;
wizardPrompts['waitingStatusCode'] = `Agora me fala qual o status code que o serviço tem que retornar. Por exemplo, 200.`;
wizardPrompts['waitingName'] = `Feito. Que nome você quer dar para esse serviço?`;
wizardPrompts['done'] = `Ok. Agora é só abrir uma RLI para DITEC/LABBS/BORRACHARIA... brincadeira! Se o serviço sair do ar eu te aviso :)`;

const helpText = `Meu job é monitorar serviços. Olha aí o que eu posso fazer por você:\n\n/list Listo os serviços que estou monitorando\n/monitor Monitoro um novo serviço (ou atualizo)\n/remove Paro de monitorar um serviço`;

bot.on('text', msg => {

	if(!msg.text.startsWith('/'))
		checkStep(msg);

});

bot.on('/monitor', msg => {

	let fromId = msg.from.id;
	let firstName = msg.from.first_name;
	util.log(`Recebido /monitor de ${ firstName }`);
	userSessions[fromId] = {step:'waitingURL', name: firstName, serviceURL: '', serviceName: ''};
	let step = userSessions[fromId].step;

	return bot.sendMessage(msg.from.id, `Ok, ${ firstName }. ${ wizardPrompts[step] }`);
});

bot.on('/list', msg => {

	let fromId = msg.from.id;
	let firstName = msg.from.first_name;
	util.log(`Recebido /list de ${ firstName }`);
	let monitorsText = '';

	if (monitors[fromId] && monitors[fromId].monitors.length > 0){
		
		monitors[fromId].monitors.forEach(function(entry) {
			monitorsText = `${ monitorsText } ${ entry.serviceName}=${ entry.serviceURL }\n`;
		});

		monitorsText = `Oi ${ firstName }. Seus serviços monitorados são: \n${ monitorsText }`;
	}else{
		monitorsText = `Oi ${ firstName }. Você não tem serviços monitorados.`;
	}

	return bot.sendMessage(msg.from.id, monitorsText);
});

bot.on('/remove', msg => {

	let fromId = msg.from.id;
	let firstName = msg.from.first_name;

	let service = msg.text.replace('/remove ', '');

	util.log(`Recebido /remove de ${ firstName } para serviço ${ service }`);

	let filteredServices = removeService(monitors[fromId].monitors, service);

	if (filteredServices.length == monitors[fromId].monitors.length){
		return bot.sendMessage(msg.from.id, `Serviço não encontrado. Veja seus serviços monitorados com /list`);
	}else{
		monitors[fromId].monitors = filteredServices;
		return bot.sendMessage(msg.from.id, `Serviço ${ service } não será mais monitorado.`);
	}

});

bot.on('/check', msg => {

	let fromId = msg.from.id;
	let firstName = msg.from.first_name;

	let [cmdName, service] = msg.text.split(' ');

	util.log(`Recebido /check de ${ firstName }.`);

	checker.checkService(bot, fromId, monitors[fromId].name, monitors[fromId].monitors);

});

bot.on('/help', msg => {

	let fromId = msg.from.id;
	let firstName = msg.from.first_name;

	let [cmdName, service] = msg.text.split(' ');

	util.log(`Recebido /help de ${ firstName }.`);

	return bot.sendMessage(msg.from.id, `Oi ${ firstName }!\n\n${ helpText }`);

});

function checkStep(msg){

	let fromId = msg.from.id;
	let reply = msg.message_id;

	if (userSessions[fromId]){

		let step = userSessions[fromId].step;
		let name = userSessions[fromId].name;

		util.log(`Usuário ${ name } terminou step ${ step }.`);

		if (step == 'waitingURL'){

			userSessions[fromId].serviceURL = msg.text;
			step = 'waitingStatusCode';
			userSessions[fromId].step = step;

			return bot.sendMessage(fromId, wizardPrompts[step]);

		}else if(step == 'waitingStatusCode'){

			userSessions[fromId].statusCode = msg.text;
			step = 'waitingName';
			userSessions[fromId].step = step;

			return bot.sendMessage(fromId, wizardPrompts[step]);

		}else if(step == 'waitingName'){

			userSessions[fromId].serviceName = msg.text;

			let userMonitors = [];

			if (monitors[fromId]){
				userMonitors = monitors[fromId].monitors;
			}else{
				monitors[fromId] = {id: fromId, name: '', monitors: []};
			}

			monitors[fromId].name = name;

			userMonitors = removeService(userMonitors, userSessions[fromId].serviceName);
			userMonitors.push({serviceName: userSessions[fromId].serviceName, serviceURL: userSessions[fromId].serviceURL, statusCode: userSessions[fromId].statusCode});

			monitors[fromId].monitors = userMonitors;
			userSessions[fromId] = null;

			util.log(monitors[fromId]);

			return bot.sendMessage(fromId, wizardPrompts['done']);			
		}
	}else{
		return bot.sendMessage(fromId, 'Desculpe, não sei o que você quer. Se quiser monitorar um serviço, digite /monitor, ou se quiser ver seus serviços digite /list.', { reply });		
	}
}

function removeService(services, name){

	return services.filter((entry) => {
				if (entry.serviceName == name)
					return false;

				return true;
			});
}


function checkAllMonitors(){

	util.log("Testando todos serviços.");

	for (var id in monitors) {
		if (monitors.hasOwnProperty(id)) {
			let monitor = monitors[id];
			checker.checkService(bot, monitor.id, monitor.name, monitor.monitors);
		}
	}
}


function persistData(){

	util.log("Persistindo estado.");

	let safeCopy = JSON.parse(JSON.stringify(monitors));

	fs.writeFile( "monitors.json", JSON.stringify(safeCopy), "utf8", (err) => {
		if (err)
			util.log(err);
	});
}

bot.connect();

setInterval(checkAllMonitors, 300000);
setInterval(persistData, 300000);
