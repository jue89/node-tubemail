const EventEmitter = require('events');

jest.mock('../msgtypes/00-hello.js');
const mockHello = require('../msgtypes/00-hello.js');

jest.mock('../msgtypes/01-iam.js');
const mockIam = require('../msgtypes/01-iam.js');

jest.mock('../msgtypes/02-neigh.js');
const mockNeigh = require('../msgtypes/02-neigh.js');

jest.mock('../msgtypes/03-data-buffer.js');
const mockDataBuffer = require('../msgtypes/03-data-buffer.js');

const connectionFacory = () => {
	const connection = new EventEmitter();
	connection.send = jest.fn(() => Promise.resolve());
	connection.close = jest.fn(() => Promise.resolve());
	return connection;
};

const hoodFacory = () => {
	const hood = new EventEmitter();
	hood.getNeigh = jest.fn();
	hood.neighbours = [];
	return hood;
};

const neigh = require('../neigh.js');

describe('Neighbour', () => {
	test('store connection info', () => {
		const connection = connectionFacory();
		connection.direction = 'in';
		connection.info = {};
		connection.host = 'abc';
		connection.port = 1234;
		const hood = {};
		const n = neigh(hood, connection);
		expect(n.ctx.direction).toBe(connection.direction);
		expect(n.ctx.info).toBe(connection.info);
		expect(n.ctx.host).toBe(connection.host);
		expect(n.ctx.port).toBe(connection.port);
		expect(n.ctx.hood).toBe(hood);
	});

	test('parse incoming packets', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const onHello = jest.fn();
		n.ctx.ipkt.on('iam', onHello);
		const iam = {};
		mockIam.unpack.mockReturnValue(iam);
		const data = Buffer.alloc(3, 42);
		connection.emit('message', Buffer.concat([mockIam.field, data]));
		expect(mockIam.unpack.mock.calls[0][0].toString('hex')).toEqual(data.toString('hex'));
		expect(onHello.mock.calls[0][0]).toBe(iam);
	});

	test('emit parser error if message is empty', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const onParserError = jest.fn();
		n.ctx.on('parserError', onParserError);
		connection.emit('message', Buffer.alloc(0));
		expect(onParserError.mock.calls[0][0].message).toEqual('Received empty frame');
	});

	test('emit parser error if message type is unknown', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const onParserError = jest.fn();
		n.ctx.on('parserError', onParserError);
		connection.emit('message', Buffer.alloc(1, 99));
		expect(onParserError.mock.calls[0][0].message).toEqual('Unknown frametype: 99');
	});

	test('emit parser error if message cannot be unpacked', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const onParserError = jest.fn();
		n.ctx.on('parserError', onParserError);
		const err = new Error();
		mockIam.unpack.mockImplementation(() => { throw err; });
		connection.emit('message', Buffer.alloc(1, 1));
		expect(onParserError.mock.calls[0][0]).toBe(err);
	});

	test('send outgress packets', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const payload = Buffer.from('abc');
		mockIam.pack.mockReturnValue(payload);
		const data = {};
		n.ctx.opkt.emit('iam', data);
		expect(mockIam.pack.mock.calls[0][0]).toBe(data);
		expect(Buffer.concat(connection.send.mock.calls[0][0]).toString('hex')).toEqual(Buffer.concat([mockIam.field, payload]).toString('hex'));
	});

	test('propagate connection close event', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const onClose = jest.fn();
		n.ctx.on('close', onClose);
		connection.emit('close');
		expect(onClose.mock.calls.length).toBe(1);
	});

	test('convert connection error events to close events', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		const onClose = jest.fn();
		n.ctx.on('close', onClose);
		connection.emit('error', new Error());
		expect(onClose.mock.calls.length).toBe(1);
	});

	test('send payload', () => {
		const needle = {};
		const connection = connectionFacory();
		connection.send.mockReturnValueOnce(Promise.resolve(needle));
		const n = neigh({}, connection);
		const payload = Buffer.alloc(0);
		const q = n.ctx.send(payload);
		expect(q).toBeInstanceOf(Promise);
		expect(mockDataBuffer.pack.mock.calls[0][0]).toBe(payload);
		return expect(q).resolves.toBe(needle);
	});
});

describe('State: hello', () => {
	test('emit hello packet', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		n.testState('hello');
		expect(mockHello.pack.mock.calls.length).toBe(1);
	});

	test('receive hello packet', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		n.testState('hello');
		connection.emit('message', mockHello.field);
		expect(n.next.mock.calls[0][0]).toEqual('iam');
	});

	test('abort on close event and timeout', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		n.testState('hello');
		n.ctx.emit('close');
		expect(n.next.mock.calls[0][0].message).toEqual('remote side closed the connection');
		expect(n.next.timeout.mock.calls[0][0]).toBe(10000);
		expect(n.next.timeout.mock.calls[0][1].message).toEqual('remote side sent no valid magic');
	});
});

describe('State: iam', () => {
	test('emit iam packet', () => {
		const connection = connectionFacory();
		const hood = {};
		const n = neigh(hood, connection);
		n.testState('iam');
		expect(mockIam.pack.mock.calls[0][0]).toBe(hood);
	});

	test('abort on close event and timeout', () => {
		const connection = connectionFacory();
		const n = neigh({}, connection);
		n.testState('iam');
		n.ctx.emit('close');
		expect(n.next.mock.calls[0][0].message).toEqual('remote side closed the connection');
		expect(n.next.timeout.mock.calls[0][0]).toBe(10000);
		expect(n.next.timeout.mock.calls[0][1].message).toEqual('remote side sent no valid iam packet');
	});

	test('accept outbound connection', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		hood.id = 'b';
		const n = neigh(hood, connection);
		n.testState('iam');
		const iam = {id: 'a', port: 123};
		mockIam.unpack.mockReturnValue(iam);
		connection.emit('message', mockIam.field);
		expect(n.ctx.id).toBe(iam.id);
		expect(n.ctx.listenPort).toBe(iam.port);
		expect(n.next.mock.calls[0][0]).toEqual('connected');
	});

	test('reject local id', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		hood.id = 'a';
		const n = neigh(hood, connection);
		n.testState('iam');
		mockIam.unpack.mockReturnValue({id: hood.id});
		connection.emit('message', mockIam.field);
		expect(n.next.mock.calls[0][0].message).toEqual('we connected ourselfes');
	});

	test('reject already connected ids', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		n.testState('iam');
		hood.getNeigh.mockReturnValue(true);
		const iam = {id: 'abc'};
		mockIam.unpack.mockReturnValue(iam);
		connection.emit('message', mockIam.field);
		expect(n.next.mock.calls[0][0].message).toEqual('remote ID is already connected');
	});

	test('reject inbound connections with wrong direction', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		hood.id = 'a';
		const n = neigh(hood, connection);
		n.testState('iam');
		n.ctx.direction = 'in';
		n.ctx.host = 'abc';
		const iam = {id: 'b', port: 6543};
		mockIam.unpack.mockReturnValue(iam);
		const onDiscovery = jest.fn();
		hood.on('discovery', onDiscovery);
		connection.emit('message', mockIam.field);
		expect(n.next.mock.calls[0][0].message).toEqual('remote ID lower than ours');
		expect(onDiscovery.mock.calls[0][0]).toMatchObject({
			port: iam.port,
			host: n.ctx.host
		});
	});

	test('reject outbound connections with wrong direction', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		hood.id = 'b';
		const n = neigh(hood, connection);
		n.testState('iam');
		n.ctx.direction = 'out';
		const iam = {id: 'a'};
		mockIam.unpack.mockReturnValue(iam);
		connection.emit('message', mockIam.field);
		expect(n.next.mock.calls[0][0].message).toEqual('remote ID higher than ours');
	});
});

describe('State: connected', () => {
	test('emit found neigh event', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		const onFoundNeigh = jest.fn();
		hood.on('foundNeigh', onFoundNeigh);
		n.testState('connected');
		expect(onFoundNeigh.mock.calls[0][0]).toBe(n.ctx);
	});

	test('listen to neigh packets and emit discovery event', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		const onDiscovery = jest.fn();
		hood.on('discovery', onDiscovery);
		n.testState('connected');
		const potentialNeigh = {};
		mockNeigh.unpack.mockReturnValue(potentialNeigh);
		connection.emit('message', mockNeigh.field);
		expect(onDiscovery.mock.calls[0][0]).toBe(potentialNeigh);
	});

	test('emit neigh packet on found neigh event', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		n.testState('connected');
		const data = {id: '', listenPort: 123, host: 'abc'};
		hood.emit('foundNeigh', data);
		expect(mockNeigh.pack.mock.calls[0][0]).toMatchObject({
			id: data.id,
			port: data.listenPort,
			host: data.host
		});
	});

	test('emit neigh packet on start', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const data = { id: '', listenPort: 123, host: 'abc' };
		hood.neighbours.push(data);
		const n = neigh(hood, connection);
		n.testState('connected');
		expect(mockNeigh.pack.mock.calls[0][0]).toMatchObject({
			id: data.id,
			port: data.listenPort,
			host: data.host
		});
	});

	test('listen for data', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		n.testState('connected');
		const payload = Buffer.alloc(0);
		mockDataBuffer.unpack.mockReturnValue(payload);
		const onMessage = jest.fn();
		hood.on('message', onMessage);
		n.ctx.on('message', onMessage);
		connection.emit('message', mockDataBuffer.field);
		expect(onMessage.mock.calls[0][0]).toBe(payload);
		expect(onMessage.mock.calls[0][1]).toBe(n.ctx);
		expect(onMessage.mock.calls[1][0]).toBe(payload);
		expect(onMessage.mock.calls[1][1]).toBe(n.ctx);
	});

	test('listen for close events', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		n.testState('connected');
		n.ctx.emit('close');
		expect(n.next.mock.calls[0][0]).toBe(null);
	});
});

describe('State: final', () => {
	test('emit lost neigh event if no error occured', () => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		const onLostNeigh = jest.fn();
		hood.on('lostNeigh', onLostNeigh);
		n.testState('_final');
		expect(onLostNeigh.mock.calls[0][0]).toBe(n.ctx);
		expect(onLostNeigh.mock.calls.length).toBe(1);
		n.testState('_final', new Error());
		expect(onLostNeigh.mock.calls.length).toBe(1);
	});

	test('close connection', (done) => {
		const connection = connectionFacory();
		const hood = hoodFacory();
		const n = neigh(hood, connection);
		n.testState('_final');
		expect(connection.close.mock.calls.length).toBe(1);
		n.ctx.on('goodbye', done);
	});
});
