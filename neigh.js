const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const EDFSM = require('edfsm');
const util = require('util');
const debug = util.debuglog('tubemail-neigh');

const msgTypesDir = path.join(__dirname, 'msgtypes');
const msgTypes = fs.readdirSync(msgTypesDir)
	.filter((file) => file.substr(-3) === '.js')
	.sort()
	.map((file) => require(path.join(msgTypesDir, file)));

class Neighbour extends EventEmitter {
	constructor (hood, connection) {
		super();

		this.hood = hood;
		this.connection = connection;
		this.direction = connection.direction;
		this.info = connection.info;
		this.host = connection.host;
		this.port = connection.port;

		// Listen to ingress messages
		this.ipkt = new EventEmitter();
		this.connection.on('message', (frame) => {
			try {
				// Make sure the frame is not empty
				if (frame.length === 0) {
					throw new Error(`Received empty frame`);
				}

				// Identify the frame type
				const type = msgTypes[frame[0]];
				if (type === undefined) {
					throw new Error(`Unknown frametype: ${frame[0]}`);
				}

				// Convert payload
				const payload = type.unpack(frame.slice(1));

				debug('%s ingress: %s', this.toString(), type.name);
				this.ipkt.emit(type.name, payload);
			} catch (err) {
				debug('%s parser error: %s', this.toString(), err.message);
				this.emit('parserError', err);
			}
		});

		// Listen to outgress packets
		this.opkt = new EventEmitter();
		msgTypes.forEach((type) => {
			this.opkt.on(type.name, (data) => {
				this.connection.send([type.field, type.pack(data)]);
				debug('%s outgress: %s', this.toString(), type.name);
			});
		});

		// Propagate close events
		this.connection.on('close', () => this.emit('close'));
	}

	send (msg) {
		this.opkt.emit('data-buffer', msg);
	}

	toString () {
		let idStr = `Neighbour [${this.host}]:${this.port}`;
		if (this.id) idStr += ` ${this.id.slice(0, 7)}`;
		return `<${idStr}>`;
	}
}

module.exports = (hood, connection) => {
	const ctx = new Neighbour(hood, connection);
	return EDFSM({
		inputs: {
			main: ctx,
			hood: hood,
			pkt: ctx.ipkt
		},
		outputs: {
			main: ctx,
			hood: hood,
			pkt: ctx.opkt
		}
	}).state('hello', (ctx, i, o, next) => {
		o.pkt('hello');
		i.pkt('hello', () => next('iam'));
		i('close', () => next(new Error('remote side closed the connection')));
		next.timeout(10000, new Error('remote side sent no valid magic'));
	}).state('iam', (ctx, i, o, next) => {
		o.pkt('iam', ctx.hood);
		i.pkt('iam', (pkt) => {
			// Store pkt information
			ctx.id = pkt.id;
			ctx.listenPort = pkt.port;

			// Check ID
			if (pkt.id === ctx.hood.id) return next(new Error('we connected ourselfes'));
			if (ctx.hood.getNeigh({id: pkt.id})) return next(new Error('remote ID is already connected'));
			if (ctx.direction === 'in' && pkt.id > ctx.hood.id) {
				o.hood('discovery', { host: ctx.host, port: pkt.port });
				return next(new Error('remote ID lower than ours'));
			} else if (ctx.direction === 'out' && pkt.id < ctx.hood.id) {
				return next(new Error('remote ID higher than ours'));
			}

			// We found a new neighbour \o/
			next('connected');
		});
		i('close', () => next(new Error('remote side closed the connection')));
		next.timeout(10000, new Error('remote side sent no valid iam packet'));
	}).state('connected', (ctx, i, o, next) => {
		// Tell everybody about the new neighbour
		o.hood('foundNeigh', ctx);
		debug('%s connected', ctx.toString());

		// Listen to neighbours from the remote side
		i.pkt('neigh', (pkt) => o.hood('discovery', pkt));

		// Tell our neighbour about the other neighbours
		const publishNeigh = (neigh) => {
			if (neigh === ctx) return;
			o.pkt('neigh', {
				host: neigh.host,
				port: neigh.listenPort,
				id: neigh.id
			});
			debug('%s neighbour advertise: [%s]:%s %s', ctx.toString(), neigh.host, neigh.listenPort, neigh.id.slice(0, 7));
		};
		i.hood('foundNeigh', (n) => publishNeigh(n));
		ctx.hood.neighbours.forEach((n) => publishNeigh(n));

		// Listen for data
		i.pkt('data-buffer', (msg) => {
			o('message', msg, ctx);
			o.hood('message', msg, ctx);
		});

		// Listen for close events of the underlaying socket
		i('close', () => next(null));
	}).final((ctx, i, o, end, err) => {
		if (!err) {
			o.hood('lostNeigh', ctx);
			debug('%s disconnected', ctx.toString());
		} else {
			debug('%s disconnected: %s', ctx.toString(), err.message);
		}
		ctx.connection.close().then(() => {
			o('goodbye');
			end();
		});
	}).run(ctx);
};
