const FSM = require('../fsm.js');

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
	const fsm = FSM({
		firstState: 'first',
		states: {
			first: () => Promise.resolve('second'),
			second: () => {}
		}
	})({});
	fsm.once('state', (newState, oldState) => {
		try {
			expect(newState).toEqual('first');
			expect(oldState).toBe(undefined);
			fsm.once('state', (newState, oldState) => {
				try {
					expect(newState).toEqual('second');
					expect(oldState).toEqual('first');
					done();
				} catch (e) { done(e); }
			});
		} catch (e) { done(e); }
	});
});
