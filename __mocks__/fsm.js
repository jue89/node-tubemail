const EventEmitter = require('events');

module.exports.FSM = (config) => {
	module.exports.__config = config;
	return (data) => {
		const fsm = new EventEmitter();
		module.exports.__data = data;
		module.exports.__fsm = fsm;
		return fsm;
	};
};
