'use stict';

const events = require( 'events' );
const os = require( 'os' );
const tls = require( 'tls' );
const jsonGate = require( 'json-gate' );
const newNode = require( './node.js' ).newNode;
const utils = require( './utils.js' );

const S_COLD          = 'cold';          // No connections, no port bound
const S_WARM          = 'warm';          // No connections, port bound
const S_BOOTSTRAPPING = 'bootstrapping'; // No connections, try to bootstrap
const S_MESHED        = 'meshed';        // At least one connection

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
				},
				internal: {
					type: 'boolean',
					required: false,
					default: false
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


class TubeMail extends events.EventEmitter {

	constructor( options ) {

		super();

		// Make sure obtions fits into the schema
		optionSchema.validate( options );

		// Further checks: Make sure the listen address is associated
		// to one of the interfaces and not internal
		let lAddr = utils.normaliseIP( options.listen.host );

		// Go through all interfaces and their associated addresses
		let ifaces = os.networkInterfaces();
		for( let name in ifaces ) for( let i in ifaces[name] ) {
			if( utils.normaliseIP( ifaces[name][i].address ) === lAddr ) {
				if( ! options.listen.internal && ifaces[name][i].internal ) {
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

		// Create node store
		this._nodes = {};
		this._nodesCnt = 0;

		// Initialise state machine
		this._state = S_COLD;

		// Bind port
		this._server = this._bindPort().then( ( s ) => {

			// Generate localID
			this._localID = `${options.listen.host}_${options.listen.port}`;

			// Port is bound -> Warm state
			this._setState( S_WARM );

			return s;

		} ).catch( ( e ) => {

			// Something went wrong
			this.emit( 'error', e );

		} );

	}

	_bindPort() {

		let server = tls.createServer( {
			key: this._options.pki.key,
			cert: this._options.pki.cert,
			ca: this._options.pki.ca,
			requestCert: true,
			rejectUnauthorized: true
		} );

		// Upon a new node connected successfully
		server.on( 'secureConnection', ( socket ) => {

			// Setup keepalive
			socket.setKeepAlive( true, 10000 );

			// Create new node
			newNode( socket, this._localID ).then( ( node ) => {

				// Tell everbody about our new friend
				for( let n in this._nodes ) {
					this._nodes[n].newNeigh( node.id );
				}

				// Setup the new node
				this._setupNode( node );

				// Set state to meshed
				this._setState( S_MESHED );

			} );

		} );

		// Listen to stated address
		server.listen( this._options.listen.port, this._options.listen.host );

		return Promise.resolve( server );

	}

	_connect( host, port ) { return new Promise( ( resolve, reject ) => {

		// TODO: Make sure we are not connecting our own instances

		let socket = tls.connect( {
			host: host,
			port: port,
			key: this._options.pki.key,
			cert: this._options.pki.cert,
			ca: this._options.pki.ca,
			rejectUnauthorized: true,
			checkServerIdentity: () => { return undefined; } // No ID check
		} );

		socket.once( 'error', reject );

		socket.once( 'secureConnect', () => {

			// Create new node
			newNode( socket, this._localID ).then( ( node ) => {

				// Setup keepalive
				socket.setKeepAlive( true, 10000 );

				// Setup the new node
				this._setupNode( node );

				return resolve();

			} );

		} );

	} ); }

	_setupNode( node ) {

		let id = node.id;

		// Remote node has been identified -> set up node
		this._nodesCnt++;
		this._nodes[ id ] = node;

		// Event listeners
		node.on( 'data', ( obj ) => this.emit( 'data', id, obj ) );
		node.on( 'newNeigh', ( id ) => {

			// Do we already know this guy? Or is this us? -> skip
			if( this._nodes[id] || this._localID == id ) return;

			// Otherwise say hello to our new neighbor
			let tmp = id.split( '_' );
			this._connect( tmp[0], tmp[1] );

		} );
		node.on( 'close', () => {

			// Release all listerns
			node.removeAllListeners();

			// Remove node from nodes list
			this._nodesCnt--;
			delete this._nodes[ id ];

			// Emit event
			this.emit( 'neighRemove', id );

			// Set to warm state if no other connections are open
			if( this._nodesCnt === 0 ) this._setState( S_WARM );

		} );
		node.on( 'remoteError', ( e ) => this.emit( 'localNodeError', id, e ) );
		node.on( 'error', ( e ) => this.emit( 'remoteNodeError', id, e ) );

		// Emit event
		this.emit( 'neighAdd', id );

	}

	_setState( state ) {

		// Preserve old state
		let oldState = this._state;

		// Store new state
		this._state = state;

		// Emit event
		if( state != oldState ) this.emit( 'state', state, oldState );

	}

	shutdown() { return this._server.then( (s) => {

		// TODO

	} ); }

	bootstrap( host, ip ) { return this._server.then( () => {

		// Check for right state
		if( this._state == S_BOOTSTRAPPING ) {
			return Promise.reject( new Error( `Bootstrapping still in progess` ) );
		}
		if( this._state == S_MESHED ) {
			return Promise.reject( new Error( `Already bootstraped` ) );
		}
		if( this._state == S_COLD ) {
			return Promise.reject( new Error( `No Bootstrapping possible in cold state` ) );
		}

		this._setState( S_BOOTSTRAPPING );

		// Connect to stated host
		return this._connect( host, ip ).then( () => {

			// Set state to meshed
			this._setState( S_MESHED );

		} ).catch( ( e ) => {

			// Set state back to warm
			this._setState( S_WARM );

			// Throw to user catch method
			throw e;

		} );

	} ); }

	send( nodeID, obj ) {

		if( obj === undefined ) {

			obj = nodeID;

			// Send to everyone
			for( let n in this._nodes ) {
				this._nodes[n].send( obj );
			}

		} else {

			// Make sure the given node is existent
			if( ! this._nodes[ nodeID ] ) throw new Error( `Unknown node ID: ${nodeID}` );

			this._nodes[ nodeID ].send( obj );

		}

	}

	get state() {
		return this._state;
	}

	get nodes() {
		let ret = [];
		for( let n in this._nodes ) ret.push( n );
		return ret;
	}

}

module.exports = TubeMail;
