'use stict';

const events = require( 'events' );
const os = require( 'os' );
const tls = require( 'tls' );
const jsonGate = require( 'json-gate' );
const uuid = require( 'uuid' ).v4;
const Node = require( './node.js' );
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
		discovery: {
			type: 'object',
			required: false
		},
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

		// Make sure options fits into the schema
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
		this._nodesConnected = {};
		this._nodesConnectedCnt = 0;
		this._nodesLost = {};
		this._nodesLostCnt = 0;

		// Initialise state machine
		this._state = S_COLD;

		// Setup interval for reconnect handler
		this._reconnectInterval = setInterval( () => this._reconnect(), 6000 );

		// Bind port
		this._server = this._bindPort().then( ( s ) => {

			// Generate unique local ID
			this._localID = uuid();

			// Is discovery is given -> kick off
			if( typeof options.discovery == 'object' && typeof options.discovery.init == 'function' ) {
				options.discovery.init( this );
			}

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

			// Create new node
			Node.factory( {
				inboundConnection: true,
				socket: socket,
				localID: this._localID,
				listen: this._options.listen,
				remoteID: false
			} ).then( ( node ) => this._setupNode( node, true ) ).catch( () => {} );

		} );

		// Listen to stated address
		server.listen( this._options.listen.port, this._options.listen.host );

		return Promise.resolve( server );

	}

	_connect( remoteAddr, remoteID ) { return new Promise( ( resolve, reject ) => {

		let socket = tls.connect( {
			host: remoteAddr.host,
			port: remoteAddr.port,
			key: this._options.pki.key,
			cert: this._options.pki.cert,
			ca: this._options.pki.ca,
			rejectUnauthorized: true,
			checkServerIdentity: () => { return undefined; } // No ID check
		} );

		socket.once( 'error', reject );

		socket.once( 'secureConnect', () => {

			// Create new node
			Node.factory( {
				inboundConnection: false,
				socket: socket,
				localID: this._localID,
				listen: this._options.listen,
				remoteID: ( typeof remoteID == 'string' ) ? remoteID : false
			} ).then( ( node ) => {

				// Setup the new node
				this._setupNode( node, false );

				return resolve();

			} ).catch( reject );

		} );

	} ); }

	_setupNode( node, inboundConnection ) {

		let info = node.info;

		// Tell neighbors if this is an inbound connection
		if( inboundConnection ) for( let n in this._nodesConnected ) {
			this._nodesConnected[n].newNeigh( info );
		}

		// Store handle of successfully connected node
		this._nodesConnectedCnt++;
		this._nodesConnected[ info.id ] = node;

		// Event listeners:
		// - Received data
		node.on( 'data', ( obj ) => this.emit( 'data', info.id, obj ) );
		// - Node told us about new neighbors
		node.on( 'newNeigh', ( neighInfo ) => {

			// Do we already know this guy? Or is this us? -> skip
			if( this._nodesConnected[neighInfo.id] || this._localID == neighInfo.id ) return;

			// Otherwise say hello to our new neighbor
			this._connect( neighInfo.listen );

		} );
		// - Connections has been fully closed
		node.on( 'close', () => {

			// Release all listerns
			node.removeAllListeners();

			// Remove node from nodes list
			this._nodesConnectedCnt--;
			delete this._nodesConnected[ info.id ];

			// Emit event
			this.emit( 'neighRemove', info.id );

			// Set to warm state if no other connections are open
			if( this._nodesConnectedCnt === 0 ) {
				this._setState( this._nodesLostCnt > 0 ? S_BOOTSTRAPPING : S_WARM );
			}

		} );
		// - The remote node has done something realy silly
		node.on( 'remoteError', ( e ) => this.emit( 'remoteNodeError', info.id, e ) );
		// - We messed something up
		node.on( 'socketError', ( e ) => this.emit( 'localNodeError', info.id, e ) );
		// - We lost the remote node without any note (just for outbound connections)
		if( ! inboundConnection ) node.on( 'lost', () => {

			// Mark as lost node
			this._nodesLostCnt++;
			this._nodesLost[ info.id ] = {
				listen: info.listen,
				retries: 0
			};

		} );

		// Set state to meshed
		this._setState( S_MESHED );

		// Emit event
		this.emit( 'neighAdd', info.id );

	}

	_reconnect() {

		// Helper function for removing node from lost list
		const remove = ( id ) => {

			// Remove information from store
			delete this._nodesLost[ id ];
			this._nodesLostCnt--;

			// Update state if nothing is connected anymore
			if( this._nodesLostCnt === 0 && this._nodesConnectedCnt === 0 ) {
				this._setState( S_WARM );
			}

		}

		// Go through all lost nodes
		for( let id in this._nodesLost ) {

			let node = this._nodesLost[ id ];

			// Try to connect to this node
			this._connect( node.listen, id ).then( () => {
				// Successfully connected to this node!

				// Remove handle from list of lost nodes
				remove( id );

			} ).catch( ( e ) => {
				// Some error occured

				// If we discoverd an ID conflict -> remove
				if( e instanceof Node.Error && e.message == "Remote ID differs from expected ID" ) {
					// TODO: Find something nicer than checking the exact error message
					remove( id );
				}

				// Increase retries counter and remove if we tried to often
				if( ++node.retries == 60 ) {
					remove( id );
				}

			} );

		}

	}

	_setState( state ) {

		// Preserve old state
		let oldState = this._state;

		// Store new state
		this._state = state;

		// Emit event
		if( state != oldState ) {
			setImmediate( () => this.emit( 'state', state, oldState ) );
			setImmediate( () => this.emit( 'state-' + state ) );
		}

	}

	shutdown() { return this._server.then( (s) => {

		// Remove reconnect interval
		clearInterval( this._reconnectInterval );

		// Stop listening
		s.close();

		// Is discovery is given -> stop this
		if( typeof this._options.discovery == 'object' && typeof this._options.discovery.shutdown == 'function' ) {
			this._options.discovery.shutdown();
		}

		// Shutdown all sockets
		for( let n in this._nodesConnected ) this._nodesConnected[n].shutdown();

		// Wait for warm state (nobody is connected anymore)
		if( this._state == S_WARM ) return Promise.resolve();
		return new Promise( ( resolve ) => this.once( 'state-warm', resolve ) );

	} ).then( () => {

		this._setState( S_COLD );

	} ); }

	bootstrap( host, port ) { return this._server.then( () => {

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
		return this._connect( { host: host, port: port } ).catch( ( e ) => {

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
			for( let n in this._nodesConnected ) {
				this._nodesConnected[n].send( obj );
			}

		} else {

			// Make sure the given node is existent
			if( ! this._nodesConnected[ nodeID ] ) throw new Error( `Unknown node ID: ${nodeID}` );

			this._nodesConnected[ nodeID ].send( obj );

		}

	}

	getCert( nodeID ) {

		// Make sure the given node is existent
		if( ! this._nodesConnected[ nodeID ] ) throw new Error( `Unknown node ID: ${nodeID}` );

		return this._nodesConnected[ nodeID ].getCert();

	}

	get options() {
		return this._options;
	}

	get state() {
		return this._state;
	}

	get nodes() {
		let ret = [];
		for( let n in this._nodesConnected ) ret.push( n );
		return ret;
	}

}

module.exports = TubeMail;
