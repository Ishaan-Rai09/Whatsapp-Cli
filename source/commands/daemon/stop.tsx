/**
 * wa daemon stop
 *
 * Gracefully shuts down the background daemon.
 *
 * Usage:
 *   wa daemon stop
 */
import React, {useState, useEffect} from 'react';
import {Text, useApp} from 'ink';
import net from 'node:net';
import {readDaemonState, tryConnectDaemon} from '../../utils/ipc.js';
import {DAEMON_STATE_FILE} from '../../daemon/state.js';
import fs from 'node:fs/promises';

type State =
	| {phase: 'checking'}
	| {phase: 'stopping'}
	| {phase: 'done'; message: string}
	| {phase: 'error'; message: string};

/**
 * Send a stop RPC without waiting for a response (the daemon exits and the
 * socket closes before it can reply).
 */
function sendStop(port: number, token: string): Promise<void> {
	return new Promise(resolve => {
		const socket = net.createConnection({host: '127.0.0.1', port});
		socket.once('connect', () => {
			socket.write(
				JSON.stringify({id: 'stop-req', method: 'stop', token}) + '\n',
			);
			// Give it 300 ms then move on regardless
			setTimeout(() => {
				socket.destroy();
				resolve();
			}, 300);
		});
		socket.once('error', () => resolve());
	});
}

export default function DaemonStop() {
	const {exit} = useApp();
	const [state, setState] = useState<State>({phase: 'checking'});

	useEffect(() => {
		(async () => {
			try {
				const s = await readDaemonState();

				if (!s) {
					setState({phase: 'done', message: 'Daemon is not running.'});
					return;
				}

				// Check if it's actually alive
				const ipc = await tryConnectDaemon();
				if (!ipc) {
					// State file is stale – clean it up
					await fs.unlink(DAEMON_STATE_FILE).catch(() => {});
					setState({
						phase: 'done',
						message: 'Daemon was not running (cleaned up stale state file).',
					});
					return;
				}

				setState({phase: 'stopping'});
				await sendStop(s.port, s.token);

				// Wait for the process to exit (state file disappears)
				const start = Date.now();
				while (Date.now() - start < 8_000) {
					await new Promise(r => setTimeout(r, 400));
					try {
						await fs.access(DAEMON_STATE_FILE);
					} catch {
						// File gone – daemon exited
						break;
					}
				}

				setState({phase: 'done', message: `Daemon (pid ${s.pid}) stopped.`});
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

	if (state.phase === 'checking') {
		return <Text dimColor>Checking daemon…</Text>;
	}

	if (state.phase === 'stopping') {
		return <Text dimColor>Stopping daemon…</Text>;
	}

	if (state.phase === 'error') {
		return <Text color="red">✗  {state.message}</Text>;
	}

	return <Text color="green">✓  {state.message}</Text>;
}
