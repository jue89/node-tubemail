#!/bin/env node

const fs = require('fs');
const path = require('path');
const tubemail = require('..');
const readline = require('readline');
const colors = require('colors');
const {EventEmitter} = require('events');

class CmdLineInterface extends EventEmitter {
	constructor (opts) {
		super();

		this.rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			...opts
		});

		this.rl.prompt();
		this.rl.on('line', (line) => {
			process.stdout.cursorTo(0);
			process.stdout.moveCursor(0, -1);
			process.stdout.clearLine();
			this.emit('line', line);
			this.rl.prompt();
		});
		this.rl.on('close', () => this.emit('close'));
	}

	printLine (line) {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		console.log(new Date().toISOString(), line);
		this.rl.prompt(true);
	}
}

const peerName = path.basename(process.argv[1]);
tubemail({
	key: fs.readFileSync(`./hood.${peerName}.key`),
	cert: fs.readFileSync(`./hood.${peerName}.crt`),
	ca: fs.readFileSync(`./hood.crt`),
	discovery: require('tubemail-mdns')
}).then(async (hood) => {
	const cli = new CmdLineInterface({
		prompt: `<${hood.info.subject.commonName}> `,
		completer: (line) => {
			// Don't auto-complete if the line doesn't start with @
			if (line[0] !== '@') return [[], line];

			// Find all matching neighbours
			const hits = hood.neighbours
				.map((n) => '@' + n.info.subject.commonName)
				.filter((name) => name.startsWith(line));
			return [hits, line];
		}
	});

	// Track neighbours joining and leaving
	hood.on('foundNeigh', (n) => cli.printLine(colors.gray(`${n.info.subject.commonName} joins the chat`)));
	hood.on('lostNeigh', (n) => cli.printLine(colors.gray(`${n.info.subject.commonName} leaves the chat`)));

	// Read messages from CLI
	cli.on('line', (line) => {
		if (!line) return;

		if (line[0] === '@') {
			// Lines starting with @ are just sent to the stated neighbour

			// Split neighbour's name and message
			const tmp = line.slice(1).split(' ');
			const user = tmp.shift();
			line = tmp.join(' ');

			// Don't send empty messages
			if (!line) return;

			// Find the corresponding neighbour
			const neigh = hood.neighbours.find((n) => n.info.subject.commonName === user);
			if (!neigh) return cli.printLine(colors.red(`${user} not found!`));

			neigh.send(Buffer.from(line));
		} else {
			// All other lines are sent to all other neighbours
			hood.send(Buffer.from(line));
		}
		cli.printLine(`${colors.gray(`<${hood.info.subject.commonName}>`)} ${colors.brightWhite(line)}`)
	})

	// Display messages from other neighbours
	hood.on('message', (msg, n) => {
		cli.printLine(`${colors.yellow(`<${n.info.subject.commonName}>`)} ${colors.brightWhite(msg.toString())}`);
	});

	// If the CLI closes, leave the hood
	cli.on('close', () => hood.leave().then(() => process.exit()));
});
