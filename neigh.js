const EventEmitter = require('events');
const tls = require('tls');
const util = require('util');
const set = require('./set.js');
const FSM = require('./fsm.js').FSM;
const S2B = require('./stream2block.js');

const EMJ = Buffer.from('🛰');

function Neigh () {
	EventEmitter.call(this);
}
util.inherits(Neigh, EventEmitter);

const connect = (opts) => (n, state, destroy) => {
	set.hidden(n, 'socket', tls.connect({
		host: opts.remote.host,
		port: opts.remote.port,
		ca: [opts.local.ca],
		key: opts.local.key,
		cert: opts.local.cert,
		checkServerIdentity: () => undefined
	}).on('secureConnect', () => {
		state(opts.state);
	}).on('error', (err) => {
		destroy(err);
	}));
};

const checkAuth = (opts) => (n, state, destroy) => {
	if (n.socket.authorized) {
		set.hidden(n, 'interface', new S2B(n.socket));
		state(opts.state);
	} else {
		destroy(new Error(n.socket.authorizationError));
	}
};

const getSocketInfo = (opts) => (n, state, destroy) => {
	set.readonly(n, 'host', n.socket.remoteAddress);
	set.readonly(n, 'port', n.socket.remotePort);
	set.readonly(n, 'cert', n.socket.getPeerCertificate());
	state(opts.state);
};

const receiveRemoteID = (opts) => (n, state, destroy) => {
	n.interface.on('data', (x) => {
		// Check if welcome message is complete
		if (x.length !== EMJ.length + 64) return destroy(new Error('Incomplete welcome message'));
		if (Buffer.compare(EMJ, x.slice(0, EMJ.length)) !== 0) return destroy(new Error('Magic missing'));

		// Extract ID and check it if we should keep the connection
		const remoteID = x.slice(EMJ.length).toString('hex');
		if (opts.local.id < remoteID) return destroy(new Error('Remote ID higher than ours'));
		if (opts.local.id === remoteID) return destroy(new Error('We connected ourselfes'));
		set.readonly(n, 'id', remoteID);

		// Check if we already know the other side
		if (opts.local.knownIDs.indexOf(remoteID) !== -1) return destroy(new Error('Remote ID is already connected'));

		state(opts.state);
	}).on('close', () => destroy(new Error('Remote host closed the connection')));
	setTimeout(() => destroy(new Error('Remote host has not sent its ID')), 5000);
};

const sendLocalID = (opts) => (n, state, destroy) => {
	n.interface.send(Buffer.concat([EMJ, Buffer.from(opts.local.id, 'hex')]));
	state(opts.state);
};

const connected = (opts) => (n, state, destroy) => {
	n.interface.on('data', (data) => {
		n.emit('message', data);
	}).on('close', () => {
		destroy(new Error('Connection closed'));
	});
};

const outbound = (local, remote) => FSM({
	onLeave: (n) => {
		if (n.socket) {
			n.socket.removeAllListeners('secureConnect');
			n.socket.removeAllListeners('error');
		}
		if (n.interface) {
			n.interface.removeAllListeners('data');
			n.interface.removeAllListeners('close');
		}
	},
	onDestroy: (n) => {
		if (n.socket && !n.socket.destroyed) n.socket.destroy();
	},
	firstState: 'connect',
	states: {
		connect: connect({state: 'checkAuth', remote, local}),
		checkAuth: checkAuth({state: 'getSocketInfo'}),
		getSocketInfo: getSocketInfo({state: 'receiveRemoteID'}),
		receiveRemoteID: receiveRemoteID({state: 'sendLocalID', local}),
		sendLocalID: sendLocalID({state: 'connected', local}),
		connected: connected({})
	}
})(new Neigh());

// Check authorized
// Get data
// Send Magic + ID
// Receive remote Magic + ID
const inbound = () => {};

module.exports = {
	outbound,
	inbound
};
