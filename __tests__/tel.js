const TEL = require('../tel.js').TemporaryEventListener;

test('bypass on calls', () => {
	const e = { on: jest.fn() };
	const t = new TEL(e);
	const l = () => {};
	t.on('test', l);
	expect(e.on.mock.calls[0][0]).toEqual('test');
	expect(e.on.mock.calls[0][1]).toBe(l);
});

test('cascade on calls', () => {
	const e = { on: jest.fn() };
	const t = new TEL(e);
	const l = () => {};
	t.on('test1', l).on('test2', l);
	expect(e.on.mock.calls[0][0]).toEqual('test1');
	expect(e.on.mock.calls[0][1]).toBe(l);
	expect(e.on.mock.calls[1][0]).toEqual('test2');
	expect(e.on.mock.calls[1][1]).toBe(l);
});

test('clear event handler', () => {
	const e = { on: () => {}, removeListener: jest.fn() };
	const t = new TEL(e);
	const l1 = () => {};
	const l2 = () => {};
	t.on('test', l1).on('test', l2).clear();
	expect(e.removeListener.mock.calls[0][0]).toEqual('test');
	expect(e.removeListener.mock.calls[0][1]).toBe(l1);
	expect(e.removeListener.mock.calls[1][0]).toEqual('test');
	expect(e.removeListener.mock.calls[1][1]).toBe(l2);
});
test('make tel reusable', () => {
	const e = { on: () => {}, removeListener: jest.fn() };
	const t = new TEL(e);
	const l1 = () => {};
	const l2 = () => {};
	t.on('test', l1).clear();
	expect(e.removeListener.mock.calls[0][0]).toEqual('test');
	expect(e.removeListener.mock.calls[0][1]).toBe(l1);
	t.on('test', l2).clear();
	expect(e.removeListener.mock.calls[1][0]).toEqual('test');
	expect(e.removeListener.mock.calls[1][1]).toBe(l2);
});
