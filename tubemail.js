const tls = require('tls');
const x509 = require('x509');

function Tubemail (opts, server) {
	// Store required data
	this.ca = opts.ca;
	this.key = opts.key;
	this.cert = opts.cert;
	this.fingerPrint = opts.fingerPrint;

	// Kick off discovery
	opts.discovery(opts.port, opts.fingerPrint, (peer) => {
		tls.connect({
			host: peer.host,
			port: peer.port,
			ca: [this.ca],
			key: this.key,
			cert: this.cert,
			checkServerIdentity: () => undefined
		});
	});
}

const check = (cond, msg) => { if (!cond) throw new Error(msg); };
const ca2fp = (ca) => x509.parseCert(ca.toString()).fingerPrint.replace(/:/g, '').toLowerCase();

module.exports = (opts) => new Promise((resolve) => {
	// Check options
	check(opts.key !== undefined, 'key is missing');
	check(opts.key instanceof Buffer, 'key must be a buffer');
	check(opts.cert !== undefined, 'cert is missing');
	check(opts.cert instanceof Buffer, 'cert must be a buffer');
	check(opts.ca !== undefined, 'ca is missing');
	check(opts.ca instanceof Buffer, 'ca must be a buffer');
	check(opts.discovery !== undefined, 'discovery is missing');
	if (opts.port === undefined) opts.port = 4816;

	// Read fingerprint from CA
	opts.fingerPrint = ca2fp(opts.ca);

	// Create new server
	const server = tls.createServer({
		key: opts.key,
		cert: opts.cert,
		ca: [opts.ca],
		requestCert: true,
		rejectUnauthorized: true
	});

	// Once the port has been opened we can start Tubemail
	server.listen(opts.port, () => {
		const tubemail = new Tubemail(opts, server);
		resolve(tubemail);
	});
});
