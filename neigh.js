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
	onLeave: (d) => d._socket.removeAllListeners(),
	onDestroy: (d) => { if (!d._socket.destroyed) d._socket.destroy(); },
	firstState: 'connect',
	states: {
		connect: (d, state, destroy) => {
			d._socket = tls.connect({
				host: remote.host,
				port: remote.port,
				ca: [local.ca],
				key: local.key,
				cert: local.cert,
				checkServerIdentity: () => undefined
			}).on('secureConnect', () => {
				// Make sure the connection is authorized
				if (!d._socket.authorized) {
					destroy(new Error(d._socket.authorizationError));
				} else {
					state('receiveRemoteID');
				}
			});
			// TODO: Error event
		},
		receiveRemoteID: (d, state, destroy) => {
			d._socket.on('data', (x) => {
				// Check if welcome message is complete
				if (x.length !== EMJ.length + 64) return destroy(new Error('Incomplete welcome message'));
				if (Buffer.compare(EMJ, x.slice(0, EMJ.length)) !== 0) return destroy(new Error('Magic missing'));

				// Extract ID and check it if we should keep the connection
				const remoteID = x.slice(EMJ.length);
				const cmp = Buffer.compare(local.id, remoteID);
				if (cmp < 0) return destroy(new Error('Remote ID higher than ours'));
				if (cmp === 0) return destroy(new Error('We connected ourselfes'));
				setRO(d, 'id', remoteID);

				// Check if we already know the other side
				const remoteIDHex = remoteID.toString('hex');
				if (local.knownIDs.indexOf(remoteIDHex) !== -1) return destroy(new Error('Remote ID is already connected'));

				state('sendLocalID');
			});
			// TODO: Close event
			// TODO: Timeout
			// TODO: Emoji and ID in two chunks
		},
		sendLocalID: (d, state, destroy) => {}
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
