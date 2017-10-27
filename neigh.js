const tls = require('tls');

const EMJ = Buffer.from('🛰');

const connect = (opts) => new Promise((resolve, reject) => {
	const socket = tls.connect(opts);

	socket.once('secureConnect', () => {
		// Make sure the connection is authorized
		if (!socket.authorized) return socket.destroy(new Error(socket.authorizationError));
		socket.removeAllListeners();
		resolve(socket);
	});

	socket.once('error', (err) => {
		socket.removeAllListeners();
		reject(err);
	});
});

const checkWelcomeMessage = (socket, localId) => new Promise((resolve, reject) => socket.once('data', (x) => {
	const kill = (reason) => { socket.destroy(); reject(new Error(reason)); };

	// Check if we should kill the connection
	if (x.length !== 4 + 64) kill('Incomplete welcome message');
	else if (Buffer.compare(EMJ, x.slice(0, EMJ.length)) !== 0) kill('Magic missing');
	else if (Buffer.compare(localId, x.slice(EMJ.length)) < 0) kill('Remote ID higher than ours');
	else if (Buffer.compare(localId, x.slice(EMJ.length)) === 0) kill('We connected ourselfes');
	else resolve(socket);
}));

const outbound = (local, remote) => connect({
	host: remote.host,
	port: remote.port,
	ca: [local.ca],
	key: local.key,
	cert: local.cert,
	checkServerIdentity: () => undefined
}).then((socket) => checkWelcomeMessage(socket, local.id));

module.exports = {
	outbound
};
