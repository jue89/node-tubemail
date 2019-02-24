const dataBuffer = require('../03-data-buffer.js');

test('msg attributes', () => {
	expect(dataBuffer.field).toBeInstanceOf(Buffer);
	expect(dataBuffer.field.toString('hex')).toEqual('03');
	expect(dataBuffer.name).toEqual('data-buffer');
});

test('pack message', () => {
	const buffer = Buffer.alloc(0);
	expect(dataBuffer.pack(buffer)).toBe(buffer);
});

test('reject non-buffer objects', () => {
	const buffer = 'test';
	try {
		dataBuffer.pack(buffer);
		throw new Error('Failed');
	} catch (e) {
		expect(e.message).toEqual('payload is no instance of Buffer');
	}
});

test('unpack message', () => {
	const buffer = Buffer.alloc(0);
	expect(dataBuffer.unpack(buffer)).toBe(buffer);
});
