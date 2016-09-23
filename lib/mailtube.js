'use stict';

const events = require( 'events' );
const os = require( 'os' );
const jsonGate = require( 'json-gate' );
const utils = require( './utils.js' );

const S_COLD          = 0; // No connections, no port bound
const S_WARM          = 1; // No connections, port bound
const S_BOOTSTRAPPING = 3; // No connections, try to bootstrap
const S_MESHED        = 5; // At least one connection

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
				host: {
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
		let lAddr = utils.normaliseIP( options.listen.host );

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

		// Initialise state machine
		this._state = S_COLD;

		// Bind port
		this._socket = this._bindPort().then( ( s ) => {

			// Port is bound -> Warm state
			this._state = S_WARM;

			return s;

		} ).catch( ( e ) => {

			// Something went wrong
			this.emit( 'error', e );

		} );

	}

	_bindPort() { return new Promise( ( resolve, reject ) => {

		// Listen to stated address
		// TODO

	} ); }

	shutdown() { return this._socket.then( (s) => {

		// TODO

	} ); }

	bootstrap( host, ip ) { return this._socket.then( () => {

		// Check for right state
		if( this._state == S_BOOTSTRAPPING ) {
			return Pormise.reject( new Error( `Bootstrapping still in progess` ) );
		}
		if( this._state == S_MESHED ) {
			return Pormise.reject( new Error( `Already bootstraped` ) );
		}
		if( this._state == S_COLD ) {
			return Pormise.reject( new Error( `No Bootstrapping possible in cold state` ) );
		}

		this._state = S_BOOTSTRAPPING;

		// Connect to stated host
		// TODO

	} ); }

	send( nodeID, object ) {

		// TODO

	}

	getNodes() { }

}

module.exports = MailTube;
