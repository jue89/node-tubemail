'use stict';

const net = require( 'net' );

module.exports = { normaliseIP, serialise, unserialise };

function normaliseIP( ip ) {

	switch( net.isIP( ip ) ) {
		case 4:  return normaliseIPv4( ip );
		case 6:  return normaliseIPv6( ip );
		default: throw new Error( "No valid IP address" );
	}

}

function normaliseIPv4( ip ) {

	// Split IP address at point
	let tmp = ip.split( '.' );

	// Fill all elements with leading zeros
	for( let t in tmp ) {
		tmp[ t ] = '0'.repeat( 3 - tmp[t].length ) + tmp[ t ];
	}

	// Join IP again and return
	return tmp.join( '.' );

}

function normaliseIPv6( ip ) {

	// Split IP at colon
	let tmp = ip.split( ':' );
	let len = tmp.length;

	// If less than 8 array items present, fill omitted items
	if( len < 8 ) {
		// Search empty element
		let i = 0;
		while( tmp[i] !== '' ) i++;
		// Add empty elements until length is 8
		while( len < 8 ) {
			tmp.splice( i, 0, '' );
			len++;
		}
	}

	// Fill elements with leading zeros
	for( let t in tmp ) {
		tmp[ t ] = '0'.repeat( 4 - tmp[t].length ) + tmp[ t ];
	}

	// Join IP again and return
	return tmp.join( ':' );

}

function serialise( obj ) {

	return JSON.stringify( obj );

}

const REisodatetime = /\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/;
function unserialise( str ) {

	// Parse given JSOn string
	return JSON.parse( str, ( k, v ) => {

		// Buffers
		if( typeof v == 'object' && v.type === 'Buffer' && v.data instanceof Array ) return Buffer.from( v.data );

		// Date
		if( typeof v == 'string' && REisodatetime.test( v ) ) return new Date( v );

		// Otherwise: just return the given value
		return v;

	} );

}
