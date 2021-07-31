const EventEmitter = require('events');

module.exports.createServer = jest.fn(() => {
	module.exports.__createServer = new EventEmitter();
	module.exports.__createServer.listen = jest.fn();
	module.exports.__createServer.close = jest.fn();
	module.exports.__createServer.listening = true;
	return module.exports.__createServer;
});

module.exports.connect = jest.fn(() => {
	module.exports.__connect = new EventEmitter();
	module.exports.__connect.getPeerCertificate = () => ({raw: ''});
	module.exports.__connect.setKeepAlive = jest.fn();
	module.exports.__connect.authorized = true;
	module.exports.__connect.destroy = jest.fn();
	return module.exports.__connect;
});

module.exports._createSocket = () => {
	const s = new EventEmitter();
	s.getPeerCertificate = jest.fn(() => ({raw: ''}));
	s.setKeepAlive = jest.fn();
	s.authorized = true;
	s.destroy = jest.fn();
	return s;
};
