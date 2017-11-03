const EventEmitter = require('events');

const createSocket = () => {
	const socket = new EventEmitter();
	socket.write = jest.fn();
	return socket;
};

const Stream2Block = require('../stream2block.js');

test('send buffer', () => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block ]);
	stream.writeUInt32BE(block.length, 0);
	const cb = () => {};
	new Stream2Block(socket).send(block, cb);
	expect(socket.write.mock.calls[0][1]).toBe(cb);
	expect(socket.write.mock.calls[0][0].toString('hex')).toEqual(stream.toString('hex'));
});

test('send an array of buffer', () => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block, block ]);
	stream.writeUInt32BE(block.length * 2, 0);
	const cb = () => {};
	new Stream2Block(socket).send([ block, block ], cb);
	expect(socket.write.mock.calls[0][1]).toBe(cb);
	expect(socket.write.mock.calls[0][0].toString('hex')).toEqual(stream.toString('hex'));
});

test('receive buffer', (done) => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block ]);
	stream.writeUInt32BE(block.length, 0);
	new Stream2Block(socket).on('data', (data) => {
		try {
			expect(data.toString('hex')).toEqual(block.toString('hex'));
			done();
		} catch (e) { done(e); }
	});
	socket.emit('data', stream);
});

test('receive splitted buffer', (done) => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block ]);
	stream.writeUInt32BE(block.length, 0);
	new Stream2Block(socket).on('data', (data) => {
		try {
			expect(data.toString('hex')).toEqual(block.toString('hex'));
			done();
		} catch (e) { done(e); }
	});
	socket.emit('data', stream.slice(0, 8));
	socket.emit('data', stream.slice(8));
});

test('receive buffer byte by byte', (done) => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block ]);
	stream.writeUInt32BE(block.length, 0);
	new Stream2Block(socket).on('data', (data) => {
		try {
			expect(data.toString('hex')).toEqual(block.toString('hex'));
			done();
		} catch (e) { done(e); }
	});
	for (let i = 0; i < stream.length; i++) {
		socket.emit('data', stream.slice(i, i + 1));
	}
});

test('receive two buffers in one chunk', (done) => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block ]);
	stream.writeUInt32BE(block.length, 0);
	let cnt = 0;
	new Stream2Block(socket).on('data', (data) => {
		try {
			expect(data.toString('hex')).toEqual(block.toString('hex'));
			if (++cnt === 2) done();
		} catch (e) { done(e); }
	});
	socket.emit('data', Buffer.concat([ stream, stream ]));
});

test('defer data events if no one is listening', (done) => {
	const socket = createSocket();
	const block = Buffer.alloc(64, 'a');
	const stream = Buffer.concat([ Buffer.alloc(4), block ]);
	stream.writeUInt32BE(block.length, 0);
	const s2b = new Stream2Block(socket);
	socket.emit('data', stream);
	s2b.on('data', (data) => {
		try {
			expect(data.toString('hex')).toEqual(block.toString('hex'));
			done();
		} catch (e) { done(e); }
	});
});

test('forward close event', (done) => {
	const socket = createSocket();
	const s2b = new Stream2Block(socket);
	s2b.on('close', () => done());
	socket.emit('close');
});
