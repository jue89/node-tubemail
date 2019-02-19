jest.mock('x509.js');
const mockX509 = require('x509.js');

jest.mock('crypto');
const mockCrypto = require('crypto');

const x509 = require('../x509.js');

test('parse certificate', () => {
	const cert = 'abc';
	const certRaw = Buffer.from(cert);
	x509.parseCert(certRaw);
	expect(mockX509.parseCert.mock.calls[0][0]).toEqual(cert);
});

test('get fingerprint', () => {
	const data = Buffer.alloc(32, 'b');
	const cert = [
		'',
		'-----BEGIN CERTIFICATE-----',
		data.toString('base64'),
		'-----END CERTIFICATE-----',
		''
	].join('\n');
	const hash = '123456';
	mockCrypto.__createHash.digest.mockReturnValue(hash);
	expect(x509.getFingerprint(Buffer.from(cert))).toBe(hash);
	expect(mockCrypto.__createHash.digest.mock.calls[0][0]).toEqual('hex');
	expect(mockCrypto.__createHash.update.mock.calls[0][0].toString('hex')).toEqual(data.toString('hex'));
	expect(mockCrypto.createHash.mock.calls[0][0]).toEqual('sha256');
});
