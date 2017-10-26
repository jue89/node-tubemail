const crypto = require('crypto');
const tls = require('tls');
const x509 = require('x509');

const magicEmoji = Buffer.from('🛰');
const magicEmojiPresent = (x) => Buffer.compare(magicEmoji, x.slice(0, magicEmoji.length)) === 0;
const checkID = (id, x) => Buffer.compare(id, x.slice(magicEmoji.length));

const setRO = (obj, key, value) => Object.defineProperty(obj, key, {
	value: value,
	writable: false,
	enumerable: true,
	configurable: false
});

function Tubemail (opts, server) {
	// Store required data
	setRO(this, 'id', opts.id);
	setRO(this, 'ca', opts.ca);
	setRO(this, 'key', opts.key);
	setRO(this, 'cert', opts.cert);
	setRO(this, 'fingerPrint', opts.fingerPrint);

	// Kick off discovery and register callback for discovered peers
	opts.discovery(opts.port, opts.fingerPrint, (peer) => new Promise((resolve, reject) => {
		const socket = tls.connect({
			host: peer.host,
			port: peer.port,
			ca: [this.ca],
			key: this.key,
			cert: this.cert,
			checkServerIdentity: () => undefined
		}).once('secureConnect', () => {
			// Make sure the connection is authorized
			if (!socket.authorized) return socket.destroy(new Error(socket.authorizationError));
			socket.removeAllListeners();
			resolve(socket);
		}).once('error', (err) => reject(err));
	}).then((socket) => new Promise((resolve, reject) => socket.once('data', (chunk) => {
		const kill = (reason) => { socket.destroy(); reject(new Error(reason)); };

		// Check if we should kill the connection
		if (chunk.length !== 4 + 64) kill('Incomplete welcome message');
		else if (!magicEmojiPresent(chunk)) kill('Magic missing');
		else if (checkID(this.id, chunk) <= 0) kill('Remote ID higher than ours');
		else resolve(socket);
	}))));
}

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const ca2fp = (ca) => x509.parseCert(ca.toString()).fingerPrint.replace(/:/g, '').toLowerCase();

module.exports = (opts) => new Promise((resolve) => {
	// Check options
	check(opts.key !== undefined, 'key is missing');
	check(opts.key instanceof Buffer, 'key must be a buffer');
	check(opts.cert !== undefined, 'cert is missing');
	check(opts.cert instanceof Buffer, 'cert must be a buffer');
	check(opts.ca !== undefined, 'ca is missing');
	check(opts.ca instanceof Buffer, 'ca must be a buffer');
	check(opts.discovery !== undefined, 'discovery is missing');
	if (opts.port === undefined) opts.port = 4816;

	// Read fingerprint from CA
	opts.fingerPrint = ca2fp(opts.ca);

	// Create new server
	const server = tls.createServer({
		key: opts.key,
		cert: opts.cert,
		ca: [opts.ca],
		requestCert: true,
		rejectUnauthorized: true
	});

	// Once the port has been opened we can start Tubemail
	server.listen(opts.port, () => resolve(server));
}).then((server) => new Promise((resolve, reject) => {
	// Create some randomness! Gonna use this as an (hopefully) unique ID.
	crypto.randomBytes(64, (err, id) => {
		if (err) return reject(err);
		opts.id = id;
		resolve(new Tubemail(opts, server));
	});
}));
