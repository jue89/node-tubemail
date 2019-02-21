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

function raw2pem (raw) {
	const data = raw.toString('base64');
	const lines = [];
	lines.push('-----BEGIN CERTIFICATE-----');
	for (let i = 0; i < data.length; i += 64) {
		lines.push(data.slice(i, i + 64));
	}
	lines.push('-----END CERTIFICATE-----');
	return lines.join('\n');
}

module.exports = {parseCert, getFingerprint, raw2pem};
