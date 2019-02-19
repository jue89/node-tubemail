const crypto = require('crypto');
const x509 = require('x509.js');

function parseCert (crt) {
	return x509.parseCert(crt.toString());
}

const REcert = /-----BEGIN CERTIFICATE-----(.*)-----END CERTIFICATE-----/;
function getFingerprint (crt) {
	const trimmed = crt.toString().replace(/(\r|\n)/g, '');
	const raw = Buffer.from(REcert.exec(trimmed)[1], 'base64');
	const hash = crypto.createHash('sha256');
	hash.update(raw);
	return hash.digest('hex');
};

module.exports = {parseCert, getFingerprint};
