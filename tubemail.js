const EventEmitter = require('events');
const crypto = require('crypto');
const tls = require('tls');
const util = require('util');
const x509 = require('x509');
const set = require('./set.js');
const FSM = require('./fsm.js').FSM;
const neigh = require('./neigh.js');

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const ca2fp = (ca) => x509.parseCert(ca.toString()).fingerPrint.replace(/:/g, '').toLowerCase();

function Tubemail (opts) {
	EventEmitter.call(this);

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
	set.readonly(this, 'key', opts.key);
	set.readonly(this, 'cert', opts.cert);
	set.readonly(this, 'ca', opts.ca);
	this.port = opts.port;
	this.discovery = opts.discovery;

	// Create stores
	set.readonly(this, 'knownIDs', []);
	set.readonly(this, 'neigh', {});

	// Extract ca fingerprint
	set.readonly(this, 'fingerPrint', ca2fp(opts.ca));
}

util.inherits(Tubemail, EventEmitter);

const fsmFactory = FSM({
	firstState: 'generateLocalID',
	states: {
		generateLocalID: (tm, state, destroy) => {
			crypto.randomBytes(64, (err, id) => {
				if (err) return destroy(err);
				set.readonly(tm, 'id', id.toString('hex'));
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
			tm.socket.on('secureConnection', (socket) => {
				neigh.inbound(tm, socket);
			});

			// Kick off discovery and register callback for discovered peers
			tm.discovery(tm.port, tm.fingerPrint, (remote) => {
				neigh.outbound(tm, remote).on('state:sendLocalID', (n) => {
					// If an outbound connection reached the point that we are sending
					// our ID, the remote ID has been accepted -> store learned ID
					tm.knownIDs.push(n.id);
				}).on('state:connected', (n) => {
					// Finally store handle if the connection has been established
					tm.neigh[n.id] = n;
					tm.emit('newNeigh', n);
				}).on('destroy', (n) => {
					// TODO: Remove known ID
					// TODO: Remove events
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
		.on('state:listening', (tubemail) => resolve(tubemail));
});
