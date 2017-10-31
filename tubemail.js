const crypto = require('crypto');
const tls = require('tls');
const x509 = require('x509');
const FSM = require('./fsm.js');
const neigh = require('./neigh.js');

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const ca2fp = (ca) => x509.parseCert(ca.toString()).fingerPrint.replace(/:/g, '').toLowerCase();
const setRO = (obj, key, value) => Object.defineProperty(obj, key, {
	value: value,
	writable: false,
	enumerable: true,
	configurable: false
});

function Tubemail (opts) {
	// Check options
	check(opts.key !== undefined, 'key is missing');
	check(opts.key instanceof Buffer, 'key must be a buffer');
	check(opts.cert !== undefined, 'cert is missing');
	check(opts.cert instanceof Buffer, 'cert must be a buffer');
	check(opts.ca !== undefined, 'ca is missing');
	check(opts.ca instanceof Buffer, 'ca must be a buffer');
	check(opts.discovery !== undefined, 'discovery is missing');
	if (opts.port === undefined) opts.port = 4816;

	// Store opt data
	setRO(this, 'key', opts.key);
	setRO(this, 'cert', opts.cert);
	setRO(this, 'ca', opts.ca);
	this.port = opts.port;
	this.startDiscovery = opts.discovery;

	// Create stores
	setRO(this, 'knownIDs', []);

	// Extract ca fingerprint
	setRO(this, 'fingerPrint', ca2fp(opts.ca));
}

const fsmFactory = FSM({
	firstState: 'generateLocalID',
	states: {
		generateLocalID: (tm, state, destroy) => {
			crypto.randomBytes(64, (err, id) => {
				if (err) return destroy(err);
				setRO(tm, 'id', id);
				state('createServer');
			});
		},
		createServer: (tm, state, destroy) => {
			tm.socket = tls.createServer({
				key: tm.key,
				cert: tm.cert,
				ca: [tm.ca],
				requestCert: true,
				rejectUnauthorized: true
			});
			tm.socket.listen(tm.port, () => state('listening'));
			// TODO: Listen fails
		},
		listening: (tm, state, destroy) => {
			// React to incoming connects
			tm.socket.on('secureConnection', (socket) => neigh.inbound(tm, socket));

			// Kick off discovery and register callback for discovered peers
			tm.startDiscovery(tm.port, tm.fingerPrint, (remote) => {
				neigh.outbound(tm, remote).on('state', (n, newState) => {
					// If an outbound connection reached the point that we are sending
					// our ID, the remote ID has been accepted -> store learned ID
					if (newState === 'sendLocalID') tm.knownIDs.push(n.id.toString('hex'));
				}).on('destroy', (n) => {
					// TODO: Remove known ID
				});
			});

			// TODO: socket closed
		}
	},
	onLeave: (tm) => {
		// if (tm.socket) tm.socket.removeAllListeners();
	},
	onDestroy: (tm) => {
		// if (tm.stopDiscovery) tm.stopDiscovery();
		// if (tm.socket.listening) tm.socket.close();
	}
});

module.exports = (opts) => new Promise((resolve, reject) => {
	fsmFactory(new Tubemail(opts))
		.on('destroy', (tubemail, err, state) => reject(err))
		.on('state', (tubemail, newState) => {
			if (newState === 'listening') resolve(tubemail);
		});
});
