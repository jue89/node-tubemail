const tls = require('tls');

const EMJ = Buffer.from('🛰');

const connect = (opts) => new Promise((resolve, reject) => {
	const socket = tls.connect(opts).once('secureConnect', () => {
		// Make sure the connection is authorized
		if (!socket.authorized) return socket.destroy(new Error(socket.authorizationError));
		socket.removeAllListeners();
		resolve(socket);
	}).once('error', (err) => {
		socket.removeAllListeners();
		reject(err);
	});
});

/* const checkAuth = (socket) => {
	if (!socket.authorized) {
		socket.destroy();
		return Promise.reject(new Error(socket.authorizationError));
	}
	return Promise.resolve();
}; */

// TODO: Socket close? Magic + ID in seperate chunks
const recvId = (socket) => new Promise((resolve, reject) => socket.once('data', (x) => {
	const kill = (reason) => { socket.destroy(); reject(new Error(reason)); };
	if (x.length !== 4 + 64) return kill('Incomplete welcome message');
	if (Buffer.compare(EMJ, x.slice(0, EMJ.length)) !== 0) return kill('Magic missing');
	resolve(x.slice(EMJ.length));
}));

/* const sendId = (socket) => {}; */

// TODO: Timeouts
const outbound = (local, remote) => connect({
	host: remote.host,
	port: remote.port,
	ca: [local.ca],
	key: local.key,
	cert: local.cert,
	checkServerIdentity: () => undefined
}).then((socket) => recvId(socket).then((id) => {
	const kill = (reason) => { socket.destroy(); return Promise.reject(new Error(reason)); };
	if (Buffer.compare(local.id, id) < 0) return kill('Remote ID higher than ours');
	if (Buffer.compare(local.id, id) === 0) return kill('We connected ourselfes');
}));

// Check authorized
// Send Magic + ID
// Receive remote Magic + ID
const inbound = () => {};

module.exports = {
	outbound,
	inbound
};
