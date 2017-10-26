const tls = require('tls');

/* function Tubemail (opts, server) {

} */

const check = (cond, msg) => { if (!cond) throw new Error(msg); };

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

	// Create new server
	const server = tls.createServer({
		key: opts.key,
		cert: opts.cert,
		ca: [opts.ca],
		requestCert: true,
		rejectUnauthorized: true
	});
	server.listen(opts.port, () => resolve());
});
