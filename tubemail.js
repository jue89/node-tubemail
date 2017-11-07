const EventEmitter = require('events');
const crypto = require('crypto');
const tls = require('tls');
const util = require('util');
const x509 = require('x509');
const set = require('./set.js');
const FSM = require('./fsm.js').FSM;
const neigh = require('./neigh.js');

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const parseCert = (cert) => x509.parseCert(cert.toString());
const getFingerprint = (cert) => parseCert(cert).fingerPrint.replace(/:/g, '').toLowerCase();

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
	this.knownIDs = [];
	this.neigh = {};

	// Extract ca fingerprint and cert info
	set.readonly(this, 'fingerPrint', getFingerprint(opts.ca));
	set.readonly(this, 'info', parseCert(opts.cert));
}

util.inherits(Tubemail, EventEmitter);

Tubemail.prototype.send = function (msg) {
	for (let n in this.neigh) {
		this.neigh[n].send(msg);
	}
};

const fsmFactory = FSM({
	firstState: 'generateLocalID',
	states: {
		generateLocalID: (tm, state, destroy) => {
			crypto.randomBytes(64, (err, id) => {
				if (err) return destroy(err);
				set.hidden(tm, '_id', id);
				set.readonly(tm, 'id', id.toString('hex'));
				state('createServer');
			});
		},
		createServer: (tm, state, destroy) => {
			set.hidden(tm, 'socket', tls.createServer({
				key: tm.key,
				cert: tm.cert,
				ca: [tm.ca],
				requestCert: true,
				rejectUnauthorized: true
			}).on('error', (e) => {
				destroy(new Error(`Listening to port ${tm.port} failed: ${e.message}`));
			}).on('listening', () => {
				state('listening');
			}).listen(tm.port));
		},
		listening: (tm, state, destroy) => {
			// Destroy fsm upon leave call
			set.readonly(tm, 'leave', destroy);

			let neighs = [];
			const removeDestroyedNeighs = () => {
				neighs = neighs.filter((n) => {
					if (n.state !== undefined) return true;
					n.removeAllListeners();
					if (n.data.id) {
						tm.knownIDs = tm.knownIDs.filter((id) => id !== n.data.id);
						delete tm.neigh[n.data.id];
					}
					return false;
				});
			};

			set.hidden(tm, '_leave', () => {
				neighs.forEach((n) => n.destroy());
			});

			// React to incoming connects
			tm.socket.on('secureConnection', (socket) => {
				neighs.push(neigh.inbound(tm, socket).on('state:connected', (n) => {
					// Store handle if the connection has been established
					tm.knownIDs.push(n.id);
					tm.neigh[n.id] = n;
					n.on('message', (msg, n) => tm.emit('message', msg, n));
					tm.emit('newNeigh', n);
				}).on('destroy', (n, e) => {
					removeDestroyedNeighs();
				}));
			});

			// Kick off discovery and register callback for discovered peers
			tm.discovery(tm.port, tm.fingerPrint, (remote) => {
				neighs.push(neigh.outbound(tm, remote).on('state:sendLocalID', (n) => {
					// If an outbound connection reached the point that we are sending
					// our ID, the remote ID has been accepted -> store learned ID
					tm.knownIDs.push(n.id);
				}).on('state:connected', (n) => {
					// Finally store handle if the connection has been established
					tm.neigh[n.id] = n;
					n.on('message', (msg, n) => tm.emit('message', msg, n));
					tm.emit('newNeigh', n);
				}).on('destroy', (n, e) => {
					removeDestroyedNeighs();
				}));
			});
		}
	},
	onLeave: (tm) => {
		if (tm.socket) {
			tm.socket.removeAllListeners('error');
			tm.socket.removeAllListeners('listening');
			tm.socket.removeAllListeners('secureConnection');
		}
	},
	onDestroy: (tm) => {
		if (tm.socket && tm.socket.listening) {
			tm.socket.on('close', () => tm.emit('goodbye'));
			tm.socket.close();
		} else {
			setImmediate(() => tm.emit('goodbye'));
		}
		if (tm.stopDiscovery) tm.stopDiscovery();
		if (tm._leave) tm._leave();
	}
});

module.exports = (opts) => new Promise((resolve, reject) => {
	fsmFactory(new Tubemail(opts))
		.on('destroy', (tubemail, err, state) => reject(err))
		.on('state:listening', (tubemail) => resolve(tubemail));
});
