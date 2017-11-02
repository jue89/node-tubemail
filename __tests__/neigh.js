jest.mock('tls');
const tls = require('tls');

jest.mock('../stream2block.js');
const S2B = require('../stream2block.js');

const neigh = require('../neigh.js');

test('connect to discovered host', (done) => {
	const local = {
		id: Buffer.alloc(64, 'z').toString('hex'),
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		knownIDs: []
	};
	const remote = {
		host: 'peni$',
		port: 69
	};
	neigh.outbound(local, remote).on('state', (data, newState, oldState) => {
		if (oldState !== 'connect') return;
		try {
			expect(tls.connect.mock.calls[0][0]).toMatchObject({
				ca: [local.ca],
				key: local.key,
				cert: local.cert,
				host: remote.host,
				port: remote.port
			});
			done();
		} catch (e) { done(e); }
	}).on('destroy', (e) => done(e));
});

test('destroy connection if connection is not authorised', (done) => {
	tls.__onConnect.mockImplementationOnce(() => 'Nope');
	neigh.outbound({}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('connect');
			expect(reason.message).toEqual('Nope');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	});
});

test('destroy connection if too short welcome message has been sent', (done) => {
	neigh.outbound({}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Incomplete welcome message');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	}).on('state:receiveRemoteID', () => {
		S2B.mock.instances[0].emit('data', Buffer.alloc(3, 'X'));
	});
});

test('destroy connection if no magic emoji has been sent', (done) => {
	neigh.outbound({}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Magic missing');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	}).on('state:receiveRemoteID', () => {
		S2B.mock.instances[0].emit('data', Buffer.alloc(64 + 4, 'X'));
	});
});

test('destroy connection if remote id is higher than ours', (done) => {
	neigh.outbound({ id: Buffer.alloc(64, 'a').toString('hex') }, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Remote ID higher than ours');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	}).on('state:receiveRemoteID', () => {
		S2B.mock.instances[0].emit('data', Buffer.concat([
			Buffer.from('🛰'),
			Buffer.alloc(64, 'b')
		]));
	});
});

test('destroy connection if remote id is equal', (done) => {
	neigh.outbound({ id: Buffer.alloc(64, 'a').toString('hex') }, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('We connected ourselfes');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	}).on('state:receiveRemoteID', () => {
		S2B.mock.instances[0].emit('data', Buffer.concat([
			Buffer.from('🛰'),
			Buffer.alloc(64, 'a')
		]));
	});
});

test('destroy connection if remote id is known', (done) => {
	const id = Buffer.alloc(64, 'a');
	neigh.outbound({
		id: Buffer.alloc(64, 'x').toString('hex'),
		knownIDs: [ id.toString('hex') ]
	}, {}).on('destroy', (data, reason, state) => {
		try {
			expect(state).toEqual('receiveRemoteID');
			expect(reason.message).toEqual('Remote ID is already connected');
			expect(tls.__socket.destroy.mock.calls.length).toEqual(1);
			done();
		} catch (e) { done(e); }
	}).on('state:receiveRemoteID', () => {
		S2B.mock.instances[0].emit('data', Buffer.concat([
			Buffer.from('🛰'),
			id
		]));
	});
});

test('send local ID if we want to say hi to outbound neigh', (done) => {
	const EMJ = Buffer.from('🛰');
	const localID = Buffer.alloc(64, 'z');
	const localWelcome = Buffer.concat([ EMJ, localID ]);
	const remoteID = Buffer.alloc(64, 'a');
	const remoteWelcome = Buffer.concat([ EMJ, remoteID ]);
	const local = {
		id: localID.toString('hex'),
		ca: Buffer.alloc(0),
		key: Buffer.alloc(0),
		cert: Buffer.alloc(0),
		knownIDs: [],
		neigh: {}
	};
	const remote = {
		host: 'peni$',
		port: 69
	};
	neigh.outbound(local, remote).on('state:receiveRemoteID', () => {
		S2B.mock.instances[0].emit('data', remoteWelcome);
	}).on('state:connected', () => {
		try {
			expect(S2B.prototype.send.mock.calls[0][0].toString('hex')).toEqual(localWelcome.toString('hex'));
			done();
		} catch (e) { done(e); }
	}).on('destroy', (e) => done(e));
});
