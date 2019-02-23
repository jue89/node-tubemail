const EventEmitter = require('events');
const crypto = require('crypto');
const EDFSM = require('edfsm');
const ConnectionManager = require('./connectionManager.js');
const x509 = require('./x509.js');
const neigh = require('./neigh.js');
const util = require('util');
const debug = util.debuglog('tubemail-hood');

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
class Hood extends EventEmitter {
	constructor (opts) {
		super();

		// Check options
		check(opts.key !== undefined, 'key is missing');
		check(opts.key instanceof Buffer, 'key must be a buffer');
		check(opts.cert !== undefined, 'cert is missing');
		check(opts.cert instanceof Buffer, 'cert must be a buffer');
		check(opts.ca !== undefined, 'ca is missing');
		check(opts.ca instanceof Buffer, 'ca must be a buffer');

		// Store opts data
		this.cert = opts.cert;
		this.ca = opts.ca;
		if (opts.discovery) {
			this.startDiscovery = opts.discovery;
			if (!(this.startDiscovery instanceof Array)) {
				this.startDiscovery = [this.startDiscovery];
			}
		} else {
			this.startDiscovery = [];
		}
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
		this.neighbours = [];

		// Extract ca fingerprint and cert info
		this.fingerprint = x509.getFingerprint(opts.ca);
		this.info = x509.parseCert(opts.cert);

		// Create connectionManager
		this.connectionManager = new ConnectionManager({
			key: opts.key,
			cert: opts.cert,
			ca: [opts.ca],
			requestCert: true,
			rejectUnauthorized: true,
			checkServerIdentity: () => undefined
		});
	}

	send (msg) {
		this.neighbours.forEach((n) => n.send(msg));
	}

	getNeigh (info) {
		return this.neighbours.find((n) => {
			if (n.id === info.id) return true;
			if (n.host === info.host && n.listenPort === info.port) return true;
			return false;
		});
	}
};

module.exports = (opts) => new Promise((resolve, reject) => {
	const ctx = new Hood(opts);
	const fsm = EDFSM({
		inputs: {
			main: ctx,
			connectionManager: ctx.connectionManager
		},
		outputs: {
			main: ctx
		}
	}).state('generateLocalID', (ctx, i, o, next) => {
		// Generate our random hopefully unique local ID
		crypto.randomBytes(64, (err, id) => {
			if (err) return next(err);
			ctx.id = id.toString('hex');
			debug('local ID:', ctx.id);
			next('listen');
		});
	}).state('listen', (ctx, i, o, next) => {
		// Try to listen to one of the port candidates
		const candidate = ctx.portCandidates.shift();
		if (candidate === undefined) next(new Error('Listening failed'));
		ctx.connectionManager.listen(candidate).then(() => {
			ctx.port = candidate;
			delete ctx.portCandidates;
			debug('listening on port:', ctx.port);
			next('active');
		}).catch((err) => {
			if (err.code === 'EADDRINUSE') next('listen');
			else next(err);
		});
	}).state('active', (ctx, i, o, next) => {
		// A potential new neighbour has been found
		const activeConnections = {};
		i('discovery', (info) => {
			// Make sure the discoverd peer isn't connected outbound
			const key = `[${info.host}]:${info.port}`;
			if (activeConnections[key]) return;

			// Make sure the discoverd peer hasn't connected inbound
			if (ctx.getNeigh(info)) return;

			// Connect to potential neighbour
			debug('potential neighbour: %s', key);
			activeConnections[key] = true;
			ctx.connectionManager.connect(info, () => {
				// Remove active connection if the connection has been closed ...
				delete activeConnections[key];
			});
		});

		// Start discovery
		ctx.stopDiscovery = ctx.startDiscovery.map((start) => start(
			ctx.port,
			ctx.fingerprint,
			(info) => o('discovery', info)
		));

		// A new connection has been established.
		// This can be in- and outbound.
		i.connectionManager('connection', (connection) => {
			neigh(ctx, connection);
		});

		// We have successfully connected to a new neighbour
		i('foundNeigh', (neigh) => {
			ctx.neighbours.push(neigh);
		});

		// We lost a neighbour :/
		i('lostNeigh', (neigh) => {
			// Remove the neighbour from our list
			ctx.neighbours = ctx.neighbours.filter((n) => n !== neigh);
		});

		// Tall everybody we've set up everything
		o('listening');
	}).final((ctx, i, o, end, err) => {
		const jobs = [];

		// Stop discovery
		if (ctx.stopDiscovery instanceof Array) {
			ctx.stopDiscovery.forEach((stop) => {
				if (typeof stop !== 'function') return;
				jobs.push(stop());
			});
		}

		// Close server
		jobs.push(ctx.connectionManager.close());

		// If an error occured, raise an event
		if (err) o('error', err);

		// End EDFSM once all clean up jobs have finished
		Promise.all(jobs).then(() => {
			o('goodbye');
			end();
		});
	}).run(ctx);

	// Handle promise ...
	ctx.once('listening', () => {
		// Generate leave method
		ctx.leave = () => new Promise((resolve) => {
			fsm.next(null);
			ctx.once('goodbye', resolve);
		});

		// Return the tubemail context
		resolve(ctx);
	});
	ctx.once('error', (err) => reject(err));
});
