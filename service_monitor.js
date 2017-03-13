const request = require('request');
var util = require('util');


function checkService(bot, userID, userName, services){

	services.forEach((service) => {
		requestService(service.serviceURL, (error, statusCode) => {

			if (!statusCode){
				util.log(`${ userName }: ${ service.serviceURL} - alerta - sem conexão`);
				bot.sendMessage(userID, `Ei ${ userName }, o seu serviço ${ service.serviceName } está estranho, não consigo nem conectar! Confere lá.`);
			}else if (statusCode != service.statusCode){
				util.log(`${ userName }: ${ service.serviceURL} - alerta - statusCode ${ statusCode } X ${ service.statusCode }`);				
				bot.sendMessage(userID, `Ei ${ userName }, o seu serviço ${ service.serviceName } está estranho, acabou de retornar status code ${ statusCode }. Confere lá. A URL é ${ service.serviceURL }.`);
			}
		});
	});	
}

function requestService(serviceURL, callback){

	request.get({
		url: serviceURL
	}, (err, resp, body) => {

		if (!resp){
			callback(err, null);
		}else{
			callback(err, resp.statusCode);
		}
	});
}

exports.checkService = checkService;
