const tls = require('tls');
const FSM = require('./fsm.js');

const EMJ = Buffer.from('🛰');

const setRO = (obj, key, value) => Object.defineProperty(obj, key, {
	value: value,
	writable: false,
	enumerable: true,
	configurable: false
});

function Neigh (host, port) {
	setRO(this, 'host', host);
	setRO(this, 'port', port);
}

const outbound = (local, remote) => FSM({
	onLeave: (n) => n.socket.removeAllListeners(),
	onDestroy: (n) => { if (!n.socket.destroyed) n.socket.destroy(); },
	firstState: 'connect',
	states: {
		connect: (n, state, destroy) => {
			n.socket = tls.connect({
				host: remote.host,
				port: remote.port,
				ca: [local.ca],
				key: local.key,
				cert: local.cert,
				checkServerIdentity: () => undefined
			}).on('secureConnect', () => {
				// Make sure the connection is authorized
				if (!n.socket.authorized) {
					destroy(new Error(n.socket.authorizationError));
				} else {
					state('receiveRemoteID');
				}
			});
			// TODO: Error event
		},
		receiveRemoteID: (n, state, destroy) => {
			n.socket.on('data', (x) => {
				// Check if welcome message is complete
				if (x.length !== EMJ.length + 64) return destroy(new Error('Incomplete welcome message'));
				if (Buffer.compare(EMJ, x.slice(0, EMJ.length)) !== 0) return destroy(new Error('Magic missing'));

				// Extract ID and check it if we should keep the connection
				const remoteID = x.slice(EMJ.length).toString('hex');
				if (local.id < remoteID) return destroy(new Error('Remote ID higher than ours'));
				if (local.id === remoteID) return destroy(new Error('We connected ourselfes'));
				setRO(n, 'id', remoteID);

				// Check if we already know the other side
				if (local.knownIDs.indexOf(remoteID) !== -1) return destroy(new Error('Remote ID is already connected'));

				state('sendLocalID');
			});
			// TODO: Close event
			// TODO: Timeout
			// TODO: Emoji and ID in two chunks
		},
		sendLocalID: (n, state, destroy) => {
			n.socket.write(
				Buffer.concat([EMJ, Buffer.from(local.id, 'hex')]),
				() => state('connected')
			);
		},
		connected: (n, state, destroy) => {
			// TODO: Close event
		}
	}
})(new Neigh(remote.host, remote.port));

// Check authorized
// Send Magic + ID
// Receive remote Magic + ID
const inbound = () => {};

module.exports = {
	outbound,
	inbound
};
