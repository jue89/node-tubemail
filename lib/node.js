'use strict';

const events = require( 'events' );
const utils = require( './utils.js' );

/* p = {
	socket,            // Socket of connecting / connected remote node
	localID,           // Local ID
	listen,            // Local listen addresses
	inboundConnection, // This is an inbound connection
	remoteID           // Remote ID (optional)
} */

function factory( p ) { return new Promise( ( resolve, reject ) => {

	// General socket setup:
	// Timeout and keepalive
	p.socket.setKeepAlive( true, 10000 );

	// Create local info
	let localInfo = {
		id: p.localID,
		listen: {
			host: p.listen.host,
			port: p.listen.port
		}
	};

	// Create new node instance from socket
	let node = new Node( p.socket );

	// Timeout
	let timeout = setTimeout( () => {

		// Cancel everything
		node.removeAllListeners();
		p.socket.destroy();

		reject( new NodeError( "Identification timeout" ) );

	}, 10000 ); // TODO: Make this configurable

	// Kick of ID phase \o/
	if( p.inboundConnection ) {

		// If this is an inbound connection send ID
		node.sendInfo( localInfo );

		// Everything should be fine if the remote node told us their ID
		node.once( 'identified', () => {

			// Cancel timeout
			clearTimeout( timeout );

			resolve( node );

		} );

		// Maybe the remote connection just smashed the door after ID phase
		node.once( 'close', () => {

			// Cancel timeout
			clearTimeout( timeout );

			reject( new NodeError( "Remote node closed connection" ) );

		} );

	} else {

		// Wait for the information from the other side first
		node.once( 'identified', ( info ) => {

			// Cancel timeout
			clearTimeout( timeout );

			// Make sure the other side isn't us
			if( info.id == p.localID ) {
				node.shutdown();
				return reject( new NodeError( "We connected ourselves" ) );
			}

			// If we expect a certain remote ID (e.g. reconnect), test this
			if( p.remoteID && info.id != p.remoteID ) {
				node.shutdown();
				return reject( new NodeError( "Remote ID differs from expected ID" ) );
			}

			// Tell the other node our information in return
			node.sendInfo( localInfo );

			resolve( node );

		} );

	}

} ); }

/* Events:
- socketError -> Socket error
- remoteError -> Remote side did something unexpected
- shutdown    -> Gracefully shutdown
- lost        -> Lost node without any note
- close       -> Emitted if the socket is fully closed
- identified  -> Remote side has been outed (gay!)
- newNeigh    -> The remote sind has a new neighbor
- data        -> Data from the remote side
*/

/* Methods:
- sendInfo    -> Transmit local info
- newNeigh    -> Tell remote node about a new neighbor
- send        -> Send object to remote node
- getCert     -> Get TLS cert of remote node
- shutdown    -> Gracefully shutdown connection
*/

class Node extends events.EventEmitter {

	constructor( socket ) {

		super();

		// Store socket handle
		this._socket = socket;

		// Create stores
		this._remoteInfo = null;
		this._up = false;

		// Install data listener
		let recvBuffer = '';
		this._socket.on( 'data', ( chunk ) => {

			// Add chunk to recv buffer
			recvBuffer += chunk.toString();

			// If message delimiter is present -> process
			let delimiterPos;
			while( ( delimiterPos = recvBuffer.indexOf( '\n' ) ) != -1 ) {
				this._processDatagram( recvBuffer.slice( 0, delimiterPos ) );
				recvBuffer = recvBuffer.slice( delimiterPos + 1 );
			}

		} );

		// Install error listener
		this._socket.on( 'error', ( e ) => this.emit( 'socketError', e ) );

		// Install close listener
		this._socket.on( 'close', () => {
			// If the remote has not shutdown, we lost it without notice
			this.emit( ( this._up ) ? 'lost' : 'shutdown' );
			this.emit( 'close' );
		} );

	}

	_processDatagram( datagram ) {

		// Decode datagram
		try {

			// Extract data
			let data = utils.unserialise( datagram.slice(1) );

			// Extract type
			let type = datagram[0];

			// Call package decoder
			this._processPackage( type, data );

		} catch( e ) {

			// Emit an error if this fails
			this.emit(
				'remoteError',
				new NodeError( `Invalid JSON in datagram: ${e.message}` )
			);

		}

	}

	_processPackage( type, data ) {

		switch( type ) {
			case 'i':
				// If the remote node already told us their ID, throw an error
				if( this._remoteInfo !== null ) return this.emit(
					'remoteError',
					new NodeError( `Double identification` )
				);

				// TODO: Valid ID?

				// Otherwise store ID and connection address
				this._remoteInfo = data;

				// This node is up
				this._up = true;

				// Emit event
				this.emit( 'identified', data );

				break;

			case 'c':
				// TODO: Valid ID?

				// Emit new neighbor event
				this.emit( 'newNeigh', data );

				break;

			case 's':
				// Remove remote ID -> Graceful shutdown
				this._up = false;

				break;

			case 'd':
				// Emit data event
				this.emit( 'data', data );

				break;

			default:
				// Throw error
				return this.emit(
					'remoteError',
					new NodeError( `Unknown datagram type: ${type}` )
				);

		}

	}

	_sendPackage( type, data ) {

		// Serialise data and send to remote node
		let json = utils.serialise( data );
		this._socket.write( `${type}${json}\n` );

	}

	get info() { return this._remoteInfo; }

	sendInfo( localInfo ) {

		// Transmit our information
		this._sendPackage( 'i', localInfo );

	}

	newNeigh( neighInfo ) {

		// Tell node about new neighbors
		this._sendPackage( 'c', neighInfo );

	}

	send( obj ) {

		// Send data to remote node
		this._sendPackage( 'd', obj );

	}

	getCert() {

		// Get peer certificate if not already present
		if( ! this._cert ) {
			this._cert = this._socket.getPeerCertificate( true );
		}

		return this._cert;

	}

	shutdown() {

		this._up = false;

		// Send shutdown packet
		this._sendPackage( 's', true );

		// Close the connection
		this._socket.end();

	}

}

class NodeError extends Error {
	constructor ( message, extra ) {
		super()
		Error.captureStackTrace( this, this.constructor )
		this.name = 'NodeError'
		this.message = message
		if ( extra ) this.extra = extra
	}
}

module.exports = { factory: factory, Error: NodeError };
