/**
 * wa daemon status
 *
 * Shows whether the background daemon is running.
 *
 * Usage:
 *   wa daemon status
 */
import React, {useState, useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {readDaemonState, tryConnectDaemon} from '../../utils/ipc.js';

type State =
	| {phase: 'checking'}
	| {phase: 'done'; running: boolean; pid?: number; port?: number; startedAt?: string}
	| {phase: 'error'; message: string};

export default function DaemonStatus() {
	const {exit} = useApp();
	const [state, setState] = useState<State>({phase: 'checking'});

	useEffect(() => {
		(async () => {
			try {
				const s = await readDaemonState();
				if (!s) {
					setState({phase: 'done', running: false});
					return;
				}

				const ipc = await tryConnectDaemon();
				if (ipc) {
					setState({
						phase: 'done',
						running: true,
						pid: s.pid,
						port: s.port,
						startedAt: new Date(s.startedAt).toLocaleString(),
					});
				} else {
					setState({phase: 'done', running: false});
				}
			} catch (err) {
				setState({
					phase: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			}
		})();
	}, []);

	useEffect(() => {
		if (state.phase !== 'checking') {
			process.exitCode = state.phase === 'error' ? 1 : 0;
			exit();
		}
	}, [state, exit]);

	if (state.phase === 'checking') {
		return <Text dimColor>Checking…</Text>;
	}

	if (state.phase === 'error') {
		return <Text color="red">✗  {state.message}</Text>;
	}

	if (!state.running) {
		return (
			<Box flexDirection="column">
				<Text color="yellow">● Daemon is not running</Text>
				<Text dimColor>  Start it with:  wa daemon start</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text color="green">● Daemon is running</Text>
			<Text dimColor>  PID       : {state.pid}</Text>
			<Text dimColor>  Port      : {state.port}</Text>
			<Text dimColor>  Started   : {state.startedAt}</Text>
			<Text dimColor>  Stop with : wa daemon stop</Text>
		</Box>
	);
}
