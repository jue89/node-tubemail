const EventEmitter = require('events');
const crypto = require('crypto');
const tls = require('tls');
const util = require('util');
const x509 = require('x509');
const set = require('./set.js');
const FSM = require('./fsm.js').FSM;
const TEL = require('./tel.js').TemporaryEventListener;
const neigh = require('./neigh.js');

const debug = util.debuglog('tubemail');

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

	// Store opt data
	set.readonly(this, 'key', opts.key);
	set.readonly(this, 'cert', opts.cert);
	set.readonly(this, 'ca', opts.ca);
	this.discovery = opts.discovery;
	if (typeof opts.port === 'number') {
		this.portCandidates = [opts.port];
	} else if (typeof opts.port === 'string') {
		this.portCandidates = [parseInt(opts.port)];
	} else if (opts.port instanceof Array) {
		this.portCandidates = opts.port;
	} else if (typeof opts.port === 'object' && opts.port.from <= opts.port.to) {
		this.portCandidates = [];
		for (let i = opts.port.from; i <= opts.port.to; i++) this.portCandidates.push(i);
	} else {
		this.portCandidates = [4816, 4817, 4818, 4819];
	}

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

Tubemail.prototype.leave = function () {
	return new Promise((resolve) => {
		if (!this._destroy) throw new Error('Destroy handler missing!');
		this.once('goodbye', resolve);
		this._destroy();
	});
};

const fsmFactory = FSM({
	firstState: 'generateLocalID',
	states: {
		generateLocalID: (tm, state, destroy) => {
			crypto.randomBytes(64, (err, id) => {
				if (err) return destroy(err);
				set.hidden(tm, '_id', id);
				set.readonly(tm, 'id', id.toString('hex'));
				debug('local id:', tm.id);
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
			}));
			state('listen');
		},
		listen: (tm, state, destroy) => {
			const candidate = tm.portCandidates.shift();
			if (candidate === undefined) destroy(new Error('Listening failed'));
			tm.tel = new TEL(tm.socket).on('error', (e) => {
				if (e.code === 'EADDRINUSE') state('listen');
				else destroy(new Error(`Listening to port ${candidate} failed: ${e.message}`));
			}).on('listening', () => {
				set.readonly(tm, 'port', candidate);
				delete tm.portCandidates;
				debug('listening on port:', tm.port);
				state('listening');
			});
			tm.socket.listen(candidate);
		},
		listening: (tm, state, destroy) => {
			// Destroy fsm upon leave call
			set.hidden(tm, '_destroy', destroy);

			let neighs = [];
			const removeDestroyedNeighs = () => {
				neighs = neighs.filter((n) => {
					if (n.state !== undefined) return true;
					n.removeAllListeners();
					if (n.data.id) {
						tm.knownIDs = tm.knownIDs.filter((id) => id !== n.data.id);
						if (tm.neigh[n.data.id]) {
							delete tm.neigh[n.data.id];
							tm.emit('lostNeigh', n.data);
						}
					}
					return false;
				});
			};

			set.hidden(tm, '_leave', () => {
				neighs.forEach((n) => n.destroy());
			});

			// React to incoming connects
			tm.tel = new TEL(tm.socket).on('secureConnection', (socket) => {
				debug('inbound connection: %s:%d', socket.remoteAddress, socket.remotePort);
				neighs.push(neigh.inbound(tm, socket).on('state:connected', (n) => {
					// Store handle if the connection has been established
					tm.knownIDs.push(n.id);
					tm.neigh[n.id] = n;
					n.on('message', (msg) => tm.emit('message', msg, n));
					tm.emit('foundNeigh', n);
					debug('inbound neigh connected:', n.id);
				}).on('destroy', (n, e) => {
					removeDestroyedNeighs();
					debug('inbound neigh destroyed: %s - reason: %s', n.id || 'unknown id', e.message);
				}));
			});

			// Kick off discovery and register callback for discovered peers
			tm.discovery(tm.port, tm.fingerPrint, (remote) => {
				debug('outbound connection: %s:%d', remote.host, remote.port);
				neighs.push(neigh.outbound(tm, remote).on('state:sendLocalID', (n) => {
					// If an outbound connection reached the point that we are sending
					// our ID, the remote ID has been accepted -> store learned ID
					tm.knownIDs.push(n.id);
				}).on('state:connected', (n) => {
					// Finally store handle if the connection has been established
					tm.neigh[n.id] = n;
					n.on('message', (msg) => tm.emit('message', msg, n));
					tm.emit('foundNeigh', n);
					debug('outbound neigh connected:', n.id);
				}).on('destroy', (n, e) => {
					removeDestroyedNeighs();
					debug('outbound neigh destroyed: %s - reason: %s', n.id || 'unknown id', e.message);
				}));
			});
		}
	},
	onLeave: (tm) => {
		if (tm.tel) {
			tm.tel.clear();
			delete tm.tel;
		}
	},
	onDestroy: (tm) => {
		if (tm.socket && tm.socket.listening) {
			tm.socket.on('close', () => setImmediate(() => tm.emit('goodbye')));
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
