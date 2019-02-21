const tls = require('tls');
const EventEmitter = require('events');
const Bloxycrats = require('bloxycrats');
const x509 = require('./x509.js');
const util = require('util');
const debug = util.debuglog('tubemail-connection');

class ConnectionManager extends EventEmitter {
	constructor (opts) {
		super();
		this.activeSockets = [];
		this.opts = opts;
		this.server = tls.createServer(opts);
		this.server.on('connection', (socket) => this._activeSocketsAdd(socket));
		this.server.on('secureConnection', (socket) => this._newConnection(socket, 'in'));
		this.server.on('error', (err) => debug('Error in server context: %s', err.message));
	}

	_newConnection (socket, direction) {
		// Make sure the connection is authorized
		if (!socket.authorized) {
			debug('Rejected %s connection: %s', direction, socket.authorizationError);
			return;
		}

		// Debugging
		debug('Established %s connection: [%s]:%d', direction, socket.remoteAddress, socket.remotePort);
		socket.on('close', () => debug('Closed %s connection: [%s]:%d', direction, socket.remoteAddress, socket.remotePort));

		// Create new connction context
		const connection = new Bloxycrats(socket);
		connection.direction = direction;
		connection.info = x509.parseCert(x509.raw2pem(socket.getPeerCertificate().raw));
		connection.host = socket.remoteAddress;
		connection.port = socket.remotePort;
		this.emit('connection', connection);
	}

	_activeSocketsAdd (socket) {
		// Keep track of the socket until it is destroyed
		this.activeSockets.push(socket);
		socket.on('close', () => this._activeSocketsClean());
	}

	_activeSocketsClean () {
		// Remove all destroyed connections
		this.activeSockets = this.activeSockets.filter((c) => !c.destroyed);
	}

	listen (port) {
		// Try to listen to given port
		return new Promise((resolve, reject) => {
			this.server.once('error', (err) => reject(err));
			this.server.once('listening', () => resolve());
			this.server.listen(port);
		});
	}

	connect (opts = {}) {
		// Connect to peer
		const socket = tls.connect(Object.assign({}, this.opts, opts));
		socket.on('connect', () => this._activeSocketsAdd(socket));
		socket.on('secureConnect', () => this._newConnection(socket, 'out'));
		socket.on('error', (err) => debug('Connection error: %s', err.message));
	}

	close () {
		// Just resolve if the server isn't listening
		if (!this.server.listening) return Promise.resolve();

		// Close listening socket
		return new Promise((resolve) => {
			// Close listen socket
			this.server.close(resolve);

			// Close all client sockets
			this._activeSocketsClean();
			this.activeSockets.forEach((s) => s.destroy());
		});
	}
};

module.exports = ConnectionManager;
