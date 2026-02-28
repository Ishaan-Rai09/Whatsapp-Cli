/**
 * wa daemon start
 *
 * Launches the WhatsApp CLI daemon in the background.  The daemon keeps
 * a single WhatsApp / Puppeteer session alive so that subsequent commands
 * (chats, send, open, reply…) respond in milliseconds instead of waiting
 * 15-30 s for Chrome to start.
 *
 * Usage:
 *   wa daemon start
 */
import React, {useState, useEffect} from 'react';
import {Text, useApp} from 'ink';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {readDaemonState, tryConnectDaemon} from '../../utils/ipc.js';

type State =
	| {phase: 'checking'}
	| {phase: 'spawning'}
	| {phase: 'waiting'; dots: number}
	| {phase: 'done'; port: number; pid: number}
	| {phase: 'error'; message: string};

export default function DaemonStart() {
	const {exit} = useApp();
	const [state, setState] = useState<State>({phase: 'checking'});

	useEffect(() => {
		(async () => {
			try {
				// ── Already running? ────────────────────────────────────────
				const existing = await tryConnectDaemon();
				if (existing) {
					const s = await readDaemonState();
					setState({
						phase: 'done',
						port: s!.port,
						pid: s!.pid,
					});
					return;
				}

				// ── Spawn daemon ─────────────────────────────────────────────
				setState({phase: 'spawning'});

				const thisDir = path.dirname(fileURLToPath(import.meta.url));
				// dist/commands/daemon → ../../ → dist → daemon/server.js
				const serverPath = path.resolve(thisDir, '..', '..', 'daemon', 'server.js');

				const child = spawn(process.execPath, [serverPath], {
					detached: true,
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					stdio: 'ignore' as any,
					windowsHide: true,
				});
				child.unref();

				// ── Poll until state file appears & daemon is reachable ──────
				setState({phase: 'waiting', dots: 0});

				const start = Date.now();
				const TIMEOUT = 95_000; // slightly more than the client's 90 s timeout
				let dots = 0;

				await new Promise<void>((resolve, reject) => {
					const tick = setInterval(async () => {
						dots = (dots + 1) % 4;
						setState({phase: 'waiting', dots});

						if (Date.now() - start > TIMEOUT) {
							clearInterval(tick);
							reject(new Error('Daemon did not become ready within 95 s'));
							return;
						}

						const ipc = await tryConnectDaemon();
						if (ipc) {
							clearInterval(tick);
							resolve();
						}
					}, 600);
				});

				const s = await readDaemonState();
				setState({phase: 'done', port: s!.port, pid: s!.pid});
			} catch (err) {
				setState({
					phase: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			}
		})();
	}, []);

	useEffect(() => {
		if (state.phase === 'done' || state.phase === 'error') {
			process.exitCode = state.phase === 'error' ? 1 : 0;
			exit();
		}
	}, [state, exit]);

	if (state.phase === 'checking' || state.phase === 'spawning') {
		return <Text dimColor>Starting daemon…</Text>;
	}

	if (state.phase === 'waiting') {
		const dotsStr = '.'.repeat(state.dots + 1).padEnd(4);
		return <Text dimColor>Waiting for WhatsApp session{dotsStr}</Text>;
	}

	if (state.phase === 'error') {
		return <Text color="red">✗  {state.message}</Text>;
	}

	// done
	return (
		<Text color="green">
			✓  Daemon is running – pid {state.pid}, port {state.port}
			{'  (stop with: wa daemon stop)'}
		</Text>
	);
}
