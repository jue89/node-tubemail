const tls = require('tls');
const set = require('./set.js');
const FSM = require('./fsm.js').FSM;
const S2B = require('./stream2block.js');

const EMJ = Buffer.from('🛰');

function Neigh () {}

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
		connect: (n, state, destroy) => {
			set.hidden(n, 'socket', tls.connect({
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
					set.hidden(n, 'interface', new S2B(n.socket));
					state('getSocketInfo');
				}
			}).on('error', (err) => destroy(err)));
		},
		getSocketInfo: (n, state, destroy) => {
			set.readonly(n, 'host', n.socket.remoteAddress);
			set.readonly(n, 'port', n.socket.remotePort);
			set.readonly(n, 'cert', n.socket.getPeerCertificate());
			state('receiveRemoteID');
		},
		receiveRemoteID: (n, state, destroy) => {
			n.interface.on('data', (x) => {
				// Check if welcome message is complete
				if (x.length !== EMJ.length + 64) return destroy(new Error('Incomplete welcome message'));
				if (Buffer.compare(EMJ, x.slice(0, EMJ.length)) !== 0) return destroy(new Error('Magic missing'));

				// Extract ID and check it if we should keep the connection
				const remoteID = x.slice(EMJ.length).toString('hex');
				if (local.id < remoteID) return destroy(new Error('Remote ID higher than ours'));
				if (local.id === remoteID) return destroy(new Error('We connected ourselfes'));
				set.readonly(n, 'id', remoteID);

				// Check if we already know the other side
				if (local.knownIDs.indexOf(remoteID) !== -1) return destroy(new Error('Remote ID is already connected'));

				state('sendLocalID');
			}).on('close', () => destroy(new Error('Remote host closed the connection')));
			setTimeout(() => destroy(new Error('Remote host has not sent its ID')), 5000);
		},
		sendLocalID: (n, state, destroy) => {
			n.interface.send(Buffer.concat([EMJ, Buffer.from(local.id, 'hex')]), () => state('connected'));
		},
		connected: (n, state, destroy) => {
			// TODO: Data event
			// TODO: Close event
		}
	}
})(new Neigh());

// Check authorized
// Send Magic + ID
// Receive remote Magic + ID
const inbound = () => {};

module.exports = {
	outbound,
	inbound
};
