import {rmSync} from 'node:fs';
import {parseArgs} from 'node:util';
import * as esbuild from 'esbuild';

const {values} = parseArgs({
	options: {
		production: {type: 'boolean', short: 'p'},
		watch: {type: 'boolean', short: 'w'},
	},
});

if (values.production) {
	rmSync('dist', {recursive: true, force: true});
}

const buildOptions = {
	entryPoints: ['source/cli.ts', 'source/daemon/server.ts', 'source/commands/**/*.tsx'],
	bundle: true,
	platform: 'node',
	format: 'esm',
	outdir: 'dist',
	outbase: 'source',
	minify: values.production ?? false,
	// Leave ALL node_modules as external — Node resolves them at runtime.
	// This avoids bundling puppeteer binaries, CJS/ESM conflicts, etc.
	packages: 'external',
};

if (values.watch) {
	const ctx = await esbuild.context(buildOptions);
	await ctx.watch();
	console.log('Watching for changes...');
} else {
	await esbuild.build(buildOptions);
	console.log('Build complete!');
}
