/**
 * IPC utilities for communicating with the WhatsApp CLI daemon.
 *
 * The daemon runs on a local TCP port whose address is stored in
 * ~/.whatsapp-cli/daemon.json.  Every command can check for a running
 * daemon and, if found, avoid booting a new Puppeteer/Chrome instance.
 *
 * Public API
 * ──────────
 *   tryConnectDaemon()   – resolves to IpcClient if daemon is up, else null
 *   readDaemonState()    – reads the state file (pid, port, startedAt)
 *   isDaemonRunning()    – quick liveness check
 */
import net from 'node:net';
import fs from 'node:fs/promises';
import {DAEMON_STATE_FILE} from '../daemon/state.js';
import type {DaemonState} from '../daemon/state.js';
import type {Thread, Message} from '../types/whatsapp.js';
import type {SearchResult} from '../client.js';

export type {DaemonState};

// ─── State file helpers ───────────────────────────────────────────────────

export async function readDaemonState(): Promise<DaemonState | null> {
	try {
		const raw = await fs.readFile(DAEMON_STATE_FILE, 'utf8');
		return JSON.parse(raw) as DaemonState;
	} catch {
		return null;
	}
}

// ─── Date revival ─────────────────────────────────────────────────────────
// JSON.parse drops Date objects – convert ISO strings back to Date instances.

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function reviveDates(value: unknown): unknown {
	if (typeof value === 'string' && ISO_RE.test(value)) {
		const d = new Date(value);
		return Number.isNaN(d.getTime()) ? value : d;
	}

	if (Array.isArray(value)) {
		return value.map(reviveDates);
	}

	if (value !== null && typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			out[k] = reviveDates(v);
		}

		return out;
	}

	return value;
}

// ─── Low-level TCP call ───────────────────────────────────────────────────

type RpcResponse = {id: string; result?: unknown; error?: string};

function callPort(
	port: number,
	token: string,
	method: string,
	params?: unknown,
	timeoutMs = 30_000,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const socket = net.createConnection({host: '127.0.0.1', port});
		const id = Math.random().toString(36).slice(2);
		let buf = '';
		let settled = false;

		const finish = (fn: () => void) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			socket.destroy();
			fn();
		};

		const timer = setTimeout(() => {
			finish(() => reject(new Error(`IPC call "${method}" timed out after ${timeoutMs} ms`)));
		}, timeoutMs);

		socket.setEncoding('utf8');

		socket.on('connect', () => {
			// Include the secret token in every request
			socket.write(JSON.stringify({id, method, params, token}) + '\n');
		});

		socket.on('data', (chunk: string) => {
			buf += chunk;
			const lines = buf.split('\n');
			buf = lines.pop() ?? '';
			for (const line of lines) {
				if (!line.trim()) continue;
				try {
					const resp = JSON.parse(line) as RpcResponse;
					if (resp.id === id) {
						finish(() => {
							if (resp.error) reject(new Error(resp.error));
							else resolve(reviveDates(resp.result));
						});
					}
				} catch {}
			}
		});

		socket.on('error', err => {
			finish(() => reject(err));
		});

		socket.on('close', () => {
			finish(() => reject(new Error(`Socket closed before response for "${method}"`)));
		});
	});
}

// ─── IpcClient – mirrors the WhatsAppClient public API ───────────────────

/**
 * Proxy that forwards every method call to the running daemon over TCP.
 * Commands can use it exactly like a real WhatsAppClient.
 */
export class IpcClient {
	private readonly port: number;
	private readonly token: string;

	constructor(port: number, token: string) {
		this.port = port;
		this.token = token;
	}

	private rpc<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T> {
		return callPort(this.port, this.token, method, params, timeoutMs) as Promise<T>;
	}

	async getThreads(): Promise<Thread[]> {
		return this.rpc<Thread[]>('getThreads', undefined, 60_000);
	}

	async searchThreads(query: string): Promise<SearchResult[]> {
		return this.rpc<SearchResult[]>('searchThreads', {query});
	}

	async findChatByName(name: string): Promise<Thread | undefined> {
		const result = await this.rpc<Thread | null>('findChatByName', {name});
		return result ?? undefined;
	}

	async getMessages(chatId: string, limit?: number): Promise<Message[]> {
		return this.rpc<Message[]>('getMessages', {chatId, limit}, 60_000);
	}

	async sendMessage(chatId: string, text: string): Promise<void> {
		await this.rpc('sendMessage', {chatId, text});
	}

	async sendFile(chatId: string, filePath: string, caption = ''): Promise<void> {
		await this.rpc('sendFile', {chatId, filePath, caption}, 60_000);
	}

	async replyToMessage(messageId: string, text: string): Promise<void> {
		await this.rpc('replyToMessage', {messageId, text});
	}

	/**
	 * No-op – the daemon connection is kept alive for reuse.
	 * The real daemon is stopped only via `wa daemon stop`.
	 */
	async destroy(): Promise<void> {
		// intentional no-op
	}
}

// ─── Main export ─────────────────────────────────────────────────────────

/**
 * Returns an IpcClient connected to the running daemon, or null if the
 * daemon is not running / reachable.
 */
export async function tryConnectDaemon(): Promise<IpcClient | null> {
	const state = await readDaemonState();
	if (!state) return null;

	try {
		await callPort(state.port, state.token, 'ping', undefined, 1500);
		return new IpcClient(state.port, state.token);
	} catch {
		return null;
	}
}
