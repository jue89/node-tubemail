const FSM = require('../fsm.js').FSM;

test('run first state', (done) => {
	FSM({
		firstState: 'first',
		states: {
			first: () => done()
		}
	})({});
});

test('transit from state1 to state2', (done) => {
	FSM({
		firstState: 'first',
		states: {
			first: () => Promise.resolve('second'),
			second: () => done()
		}
	})({});
});

test('transit from state1 to state2 and call enter callback', (done) => {
	const data = {};
	let called = 0;
	FSM({
		onEnter: (d) => {
			try {
				expect(d).toBe(data);
				if (++called === 2) done();
			} catch (e) { done(e); }
		},
		firstState: 'first',
		states: {
			first: () => Promise.resolve('second'),
			second: () => {}
		}
	})(data);
});

test('transit from state1 to state2 and call leave callback', (done) => {
	const data = {};
	FSM({
		onLeave: (d) => {
			try {
				expect(d).toBe(data);
				done();
			} catch (e) { done(e); }
		},
		firstState: 'first',
		states: {
			first: () => Promise.resolve('second'),
			second: () => {}
		}
	})(data);
});

test('transit from state1 to state2 with external resolve', (done) => {
	FSM({
		firstState: 'first',
		states: {
			first: (data, resolve) => resolve('second'),
			second: () => done()
		}
	})({});
});

test('expose data object', (done) => {
	const data = {};
	FSM({
		firstState: 'first',
		states: {
			first: (d) => {
				try {
					expect(d).toBe(data);
					done();
				} catch (e) { done(e); }
			}
		}
	})(data);
});

test('call state event on transition', (done) => {
	const data = {};
	const fsm = FSM({
		firstState: 'first',
		states: {
			first: () => Promise.resolve('second'),
			second: () => {}
		}
	})(data);
	fsm.once('state', (d, newState, oldState) => {
		try {
			expect(d).toBe(data);
			expect(newState).toEqual('first');
			expect(oldState).toBe(undefined);
			fsm.once('state', (d, newState, oldState) => {
				try {
					expect(d).toBe(data);
					expect(newState).toEqual('second');
					expect(oldState).toEqual('first');
					done();
				} catch (e) { done(e); }
			});
		} catch (e) { done(e); }
	});
});

test('call named state event on transition', (done) => {
	const data = {};
	const fsm = FSM({
		firstState: 'first',
		states: {
			first: () => Promise.resolve('second'),
			second: () => {}
		}
	})(data);
	fsm.once('state:first', (d, oldState) => {
		try {
			expect(d).toBe(data);
			expect(oldState).toBe(undefined);
		} catch (e) { done(e); }
	});
	fsm.once('state:second', (d, oldState) => {
		try {
			expect(d).toBe(data);
			expect(oldState).toEqual('first');
			done();
		} catch (e) { done(e); }
	});
});

test('destroy fsm on reject', (done) => {
	const data = {};
	const fsm = FSM({
		onDestroy: (d, err, state) => {
			try {
				expect(d).toBe(data);
				expect(err.message).toEqual('test');
				expect(state).toEqual('first');
				expect(fsm.state).toBe(undefined);
				done();
			} catch (e) { done(e); }
		},
		firstState: 'first',
		states: {
			first: () => Promise.reject(new Error('test'))
		}
	})(data);
});

test('destroy fsm with reject callback', (done) => {
	FSM({
		onDestroy: (d, err) => {
			try {
				expect(err.message).toEqual('test');
				done();
			} catch (e) { done(e); }
		},
		firstState: 'first',
		states: {
			first: (data, resolve, reject) => reject(new Error('test'))
		}
	})({});
});

test('emit event if fsm is destroyed', (done) => {
	const data = {};
	const fsm = FSM({
		firstState: 'first',
		states: {
			first: (data, resolve, reject) => reject(new Error('test'))
		}
	})(data);
	fsm.on('destroy', (d, err, state) => {
		try {
			expect(d).toBe(data);
			expect(err.message).toEqual('test');
			expect(state).toEqual('first');
			done();
		} catch (e) { done(e); }
	});
});

test('call leave callback of fsm has been destroyed', (done) => {
	const data = {};
	FSM({
		onLeave: (d) => {
			try {
				expect(d).toBe(data);
				done();
			} catch (e) { done(e); }
		},
		firstState: 'first',
		states: {
			first: (data, resolve, reject) => reject()
		}
	})(data);
});
