#!/usr/bin/env node
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readPackageUp} from 'read-package-up';
import Pastel from 'pastel';
import {initializeLogger} from './utils/logger.js';

// Initialize logger as early as possible
await initializeLogger();

const scriptDir = dirname(fileURLToPath(import.meta.url));
const package_ = await readPackageUp({cwd: scriptDir});

const app = new Pastel({
	importMeta: import.meta,
	version: package_?.packageJson.version ?? '1.0.0',
	description: package_?.packageJson.description ?? 'WhatsApp CLI',
});

try {
	await app.run();
} catch (error) {
	// eslint-disable-next-line no-console
	console.error('Fatal error:', error);
	// eslint-disable-next-line n/prefer-global/process
	process.exit(1);
}
