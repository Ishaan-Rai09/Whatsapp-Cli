/**
 * Shared daemon state file path and types.
 * Kept in its own module so it can be imported by both the daemon server
 * and CLI-side helpers without triggering any daemon startup code.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

export const DAEMON_STATE_FILE = path.join(
	os.homedir(),
	'.whatsapp-cli',
	'daemon.json',
);

export type DaemonState = {
	pid: number;
	port: number;
	startedAt: string;
	/** Random secret — every IPC caller must echo it back to be authorised. */
	token: string;
};

export async function writeDaemonState(state: DaemonState): Promise<void> {
	await fs.mkdir(path.dirname(DAEMON_STATE_FILE), {recursive: true});
	// 0o600 = owner read/write only — prevents other OS users from seeing the port+token
	await fs.writeFile(DAEMON_STATE_FILE, JSON.stringify(state), {encoding: 'utf8', mode: 0o600});
}

export async function removeDaemonState(): Promise<void> {
	try {
		await fs.unlink(DAEMON_STATE_FILE);
	} catch {}
}
