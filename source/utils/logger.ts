import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const LOG_DIR = path.join(os.homedir(), '.whatsapp-cli', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'whatsapp-cli.log');

let logFileStream: fs.WriteStream | undefined;

export async function initializeLogger(): Promise<void> {
	try {
		fs.mkdirSync(LOG_DIR, {recursive: true});
		logFileStream = fs.createWriteStream(LOG_FILE, {flags: 'a'});
	} catch {
		// Silently fail – logging is non-critical
	}
}

function writeLog(level: string, context: string, message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	const line = data
		? `[${timestamp}] [${level}] [${context}] ${message} ${JSON.stringify(data)}\n`
		: `[${timestamp}] [${level}] [${context}] ${message}\n`;

	logFileStream?.write(line);
}

export type Logger = {
	info(message: string, data?: unknown): void;
	warn(message: string, data?: unknown): void;
	error(message: string, data?: unknown): void;
	debug(message: string, data?: unknown): void;
};

export function createContextualLogger(context: string): Logger {
	return {
		info: (message, data) => writeLog('INFO', context, message, data),
		warn: (message, data) => writeLog('WARN', context, message, data),
		error: (message, data) => writeLog('ERROR', context, message, data),
		debug: (message, data) => writeLog('DEBUG', context, message, data),
	};
}
