const ReconnectTimer = require('../reconnectTimer.js');

jest.useFakeTimers();
afterEach(() => jest.clearAllTimers());

test('set reconnect timer', () => {
	const reconnectInterval = 1234;
	const reconnectTimeout = reconnectInterval * 4.5;
	const rc = new ReconnectTimer({reconnectInterval, reconnectTimeout});
	const neigh = {host: '::1', listenPort: 1234};
	const onInterval = jest.fn();
	rc.add(neigh, onInterval);
	jest.advanceTimersByTime(reconnectTimeout * 20);
	expect(onInterval.mock.calls.length).toBe(4);
});

test('abort reconnect timer', () => {
	const reconnectInterval = 1234;
	const reconnectTimeout = reconnectInterval * 4.5;
	const rc = new ReconnectTimer({reconnectInterval, reconnectTimeout});
	const neigh1 = {host: '::1', listenPort: 1234};
	const onInterval1 = jest.fn();
	rc.add(neigh1, onInterval1);
	const neigh2 = {host: '::2', listenPort: 1234};
	const onInterval2 = jest.fn();
	rc.add(neigh2, onInterval2);
	jest.advanceTimersByTime(reconnectTimeout * 0.5);
	rc.remove(neigh1);
	jest.advanceTimersByTime(reconnectTimeout * 20);
	expect(onInterval1.mock.calls.length).toBe(2);
	expect(onInterval2.mock.calls.length).toBe(4);
});

test('abort all timers', () => {
	const reconnectInterval = 1234;
	const reconnectTimeout = reconnectInterval * 4.5;
	const rc = new ReconnectTimer({reconnectInterval, reconnectTimeout});
	const neigh1 = {host: '::1', listenPort: 1234};
	const onInterval1 = jest.fn();
	rc.add(neigh1, onInterval1);
	const neigh2 = {host: '::2', listenPort: 1234};
	const onInterval2 = jest.fn();
	rc.add(neigh2, onInterval2);
	jest.advanceTimersByTime(reconnectTimeout * 0.5);
	rc.removeAll();
	jest.advanceTimersByTime(reconnectTimeout * 20);
	expect(onInterval1.mock.calls.length).toBe(2);
	expect(onInterval2.mock.calls.length).toBe(2);
});
