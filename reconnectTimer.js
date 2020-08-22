const keyFromNeigh = ({host, listenPort}) => `${host}@${listenPort}`;

class ReconnectTimer {
	constructor ({reconnectInterval, reconnectTimeout}) {
		this.reconnectInterval = reconnectInterval;
		this.reconnectTimeout = reconnectTimeout;
		this.timers = new Map();
	}

	_remove (key) {
		const item = this.timers.get(key);
		if (!item) return;
		const {interval, timeout} = item;
		clearInterval(interval);
		clearTimeout(timeout);
		this.timers.delete(key);
	}

	add (neigh, onInterval) {
		const key = keyFromNeigh(neigh);
		this._remove(key);
		const interval = setInterval(onInterval, this.reconnectInterval);
		const timeout = setTimeout(() => this._remove(key), this.reconnectTimeout);
		this.timers.set(key, {interval, timeout});
	}

	remove (neigh) {
		this._remove(keyFromNeigh(neigh));
	}

	removeAll () {
		this.timers.forEach((value, key) => this._remove(key));
	}
}

module.exports = ReconnectTimer;
