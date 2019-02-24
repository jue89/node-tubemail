const net = require('net');
const jsonschema = require('jsonschema');
const schema = {
	type: 'object',
	additionalProperties: false,
	required: ['id', 'port', 'host'],
	properties: {
		'id': {type: 'string', pattern: '^[0-9a-f]{128}$'},
		'port': {type: 'integer', minimum: 0, maximum: 65535},
		'host': {type: 'string'}
	}
};
const validate = (data) => {
	const validation = jsonschema.validate(data, schema);
	if (validation.errors.length) {
		throw new Error(validation.errors[0].stack);
	}
	if (!net.isIP(data.host)) {
		throw new Error('instance.host must be an IP address');
	}
};

module.exports = {
	field: Buffer.alloc(1, 2),
	name: 'neigh',
	pack: (o) => {
		const payload = {id: o.id, port: o.port, host: o.host};
		validate(payload);
		return Buffer.from(JSON.stringify(payload));
	},
	unpack: (pkt) => {
		const payload = JSON.parse(pkt.toString());
		validate(payload);
		return payload;
	}
};
