const neigh = require('../02-neigh.js');

test('msg attributes', () => {
	expect(neigh.field).toBeInstanceOf(Buffer);
	expect(neigh.field.toString('hex')).toEqual('02');
	expect(neigh.name).toEqual('neigh');
});

test('pack message', () => {
	const obj = {
		id: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		port: 12345,
		host: 'fe80::%ens2'
	};
	const pkt = neigh.pack(obj);
	expect(pkt.toString()).toEqual(JSON.stringify(obj));
});

test('complain about wrong id format', () => {
	try {
		neigh.pack({
			id: 'x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
			port: 12345,
			host: 'fe80::'
		});
		throw new Error('Failed');
	} catch (err) {
		expect(err.message).toEqual('instance.id does not match pattern "^[0-9a-f]{128}$"');
	}
});

test('complain about wrong port format', () => {
	try {
		neigh.pack({
			id: 'f123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
			port: 99999,
			host: 'fe80::1'
		});
		throw new Error('Failed');
	} catch (err) {
		expect(err.message).toEqual('instance.port must be less than or equal to 65535');
	}
});

test('complain about wrong host format', () => {
	try {
		neigh.pack({
			id: 'f123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
			port: 9999,
			host: 'foo.bar'
		});
		throw new Error('Failed');
	} catch (err) {
		expect(err.message).toEqual('instance.host must be an IP address');
	}
});

test('unpack message', () => {
	const obj = {
		id: 'f123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
		port: 4321,
		host: '127.0.0.1'
	};
	const unpacked = neigh.unpack(Buffer.from(JSON.stringify(obj)));
	expect(unpacked).toMatchObject(obj);
});

test('complain about wrong message format', () => {
	try {
		const obj = {port: 4321, host: 'fe80::'};
		const unpacked = neigh.unpack(Buffer.from(JSON.stringify(obj)));
		expect(unpacked).toMatchObject(obj);
		throw new Error('Failed');
	} catch (e) {
		expect(e.message).toEqual('instance requires property "id"');
	}
});
