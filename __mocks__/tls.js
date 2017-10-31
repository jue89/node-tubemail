const EventEmitter = require('events');

module.exports.createServer = jest.fn(() => {
	module.exports.__server = new EventEmitter();
	module.exports.__server.listen = jest.fn((port, cb) => cb());
	return module.exports.__server;
});

module.exports.__onConnect = jest.fn(() => Buffer.concat([
	Buffer.from('🛰'),
	Buffer.alloc(64, 0)
]));

module.exports.connect = jest.fn(() => {
	module.exports.__socket = new EventEmitter();

	const onConnect = module.exports.__onConnect();
	if (onConnect instanceof Buffer) {
		module.exports.__socket.authorized = true;
		setImmediate(() => {
			module.exports.__socket.emit('secureConnect');
			setImmediate(() => {
				module.exports.__socket.emit('data', onConnect);
			});
		});
	} else if (typeof onConnect === 'string') {
		module.exports.__socket.authorized = false;
		module.exports.__socket.authorizationError = onConnect;
		setImmediate(() => module.exports.__socket.emit('secureConnect'));
	}

	module.exports.__socket.write = jest.fn((chunk, cb) => cb());

	module.exports.__socket.destroyed = false;
	module.exports.__socket.destroy = jest.fn((e) => {
		module.exports.__socket.destroyed = true;
		if (e) module.exports.__socket.emit('error', e);
	});

	return module.exports.__socket;
});
