'use stict';

const events = require( 'events' );
const os = require( 'os' );
const jsonGate = require( 'json-gate' );
const utils = require( './utils.js' );

const optionSchema = jsonGate.createSchema( {
	type: 'object',
	required: true,
	additionalProperties: false,
	properties: {
		listen: {
			type: 'object',
			required: true,
			additionalProperties: false,
			properties: {
				addr: {
					type: 'string',
					required: true
				},
				port: {
					type: 'number',
					required: false,
					default: 13370
				}
			}
		},
		bootstrap: {
			type: 'object',
			required: false,
			additionalProperties: false,
			properties: {
				addr: {
					type: 'string',
					required: true
				},
				port: {
					type: 'number',
					required: false,
					default: 13370
				}
			}
		},
		pki: {
			type: 'object',
			required: true,
			additionalProperties: false,
			properties: {
				cert: {
					type: 'string',
					required: true
				},
				key: {
					type: 'string',
					required: true
				},
				ca: {
					type: 'string',
					required: true
				}
			}
		}
	}
} );


class MailTube extends events.EventEmitter {

	constructor( options ) {

		super();

		// Make sure obtions fits into the schema
		optionSchema.validate( options );

		// Further checks: Make sure the listen address is associated to one of the
		// interfaces and not internal
		let lAddr = utils.normaliseIP( options.listen.addr );

		// Go through all interfaces and their associated addresses
		let ifaces = os.networkInterfaces();
		for( let name in ifaces ) for( let i in ifaces[name] ) {
			if( utils.normaliseIP( ifaces[name][i].address ) === lAddr ) {
				if( ifaces[name][i].internal ) {
					throw new Error( `Cannot listen to internal address: ${lAddr}` );
				}
				options.listen.interface = name;
			}
		}

		// Have we found an interface?
		if( ! options.listen.interface ) {
			throw new Error( `Found no interface to address: ${lAddr}` );
		}

		// Store options
		this._options = options;

	}

	shutdown() { }

	send( nodeID, object ) { }

	getNodes() { }

}

module.exports = MailTube;
