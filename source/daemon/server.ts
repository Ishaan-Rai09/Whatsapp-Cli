/**
 * WhatsApp CLI – Background Daemon
 *
 * Keeps a single WhatsApp / Puppeteer session alive in the background and
 * serves JSON-RPC requests over a local TCP connection so CLI commands
 * (`wa chats`, `wa send`, …) avoid paying the browser-startup cost on
 * every invocation.
 *
 * State file : ~/.whatsapp-cli/daemon.json  { pid, port, startedAt }
 * Protocol   : newline-delimited JSON
 *              → request  { id, method, params? }
 *              ← response { id, result? } | { id, error? }
 *
 * Start  : wa daemon start
 * Stop   : wa daemon stop   (or kill the process / Ctrl-C)
 */
import net from 'node:net';
import crypto from 'node:crypto';
import {WhatsAppClient} from '../client.js';
import {initializeLogger, createContextualLogger} from '../utils/logger.js';
import {
	writeDaemonState,
	removeDaemonState,
} from './state.js';
import type {DaemonState} from './state.js';

export {DAEMON_STATE_FILE} from './state.js';
export type {DaemonState} from './state.js';

// Random 32-byte hex token generated once at startup.
// Every IPC caller must include it; unknown callers are rejected immediately.
const SECRET_TOKEN = crypto.randomBytes(32).toString('hex');
// Constant-time string comparison to prevent timing attacks.
function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const ba = Buffer.from(a);
	const bb = Buffer.from(b);
	return crypto.timingSafeEqual(ba, bb);
}
// ─── JSON-RPC types ───────────────────────────────────────────────────────

type RpcRequest = {id: string; method: string; params?: unknown; token?: string};
type RpcResponse = {id: string; result?: unknown; error?: string};

// ─── Request handler ──────────────────────────────────────────────────────

async function handleRequest(
	client: WhatsAppClient,
	server: net.Server,
	req: RpcRequest,
): Promise<RpcResponse> {
	const {id, method, params, token} = req;
	const p = (params ?? {}) as Record<string, unknown>;

	// Reject any caller that does not present the correct token.
	// Use timingSafeEqual to prevent timing attacks.
	if (!token || !timingSafeEqual(token, SECRET_TOKEN)) {
		return {id, error: 'Unauthorized'};
	}

	try {
		switch (method) {
			case 'ping':
				return {id, result: 'pong'};

			case 'getStatus':
				return {id, result: client.status};

			case 'getThreads': {
				const threads = await client.getThreads();
				return {id, result: threads};
			}

			case 'searchThreads': {
				const results = await client.searchThreads((p['query'] as string) ?? '');
				return {id, result: results};
			}

			case 'findChatByName': {
				const thread = await client.findChatByName(p['name'] as string);
				return {id, result: thread ?? null};
			}

			case 'getMessages': {
				const msgs = await client.getMessages(
					p['chatId'] as string,
					p['limit'] as number | undefined,
				);
				return {id, result: msgs};
			}

			case 'sendMessage': {
				await client.sendMessage(p['chatId'] as string, p['text'] as string);
				return {id, result: null};
			}

			case 'sendFile': {
				await client.sendFile(
					p['chatId'] as string,
					p['filePath'] as string,
					(p['caption'] as string | undefined) ?? '',
				);
				return {id, result: null};
			}

			case 'replyToMessage': {
				await client.replyToMessage(
					p['messageId'] as string,
					p['text'] as string,
				);
				return {id, result: null};
			}

			case 'stop': {
				// Respond first, then shut down asynchronously
				setImmediate(() => {
					void shutdown(client, server, logger);
				});
				return {id, result: 'stopping'};
			}

			default:
				return {id, error: `Unknown RPC method: ${method}`};
		}
	} catch (err) {
		return {id, error: err instanceof Error ? err.message : String(err)};
	}
}

// ─── Shutdown ─────────────────────────────────────────────────────────────

async function shutdown(
	client: WhatsAppClient,
	server: net.Server,
	log: ReturnType<typeof createContextualLogger>,
): Promise<void> {
	log.info('Daemon shutting down…');
	server.close();
	await client.destroy().catch(() => {});
	await removeDaemonState();
	process.exit(0);
}

// ─── Main ─────────────────────────────────────────────────────────────────

await initializeLogger();
const logger = createContextualLogger('Daemon');

logger.info('Starting WhatsApp client…');
process.stdout.write('Starting WhatsApp session…\n');

const client = new WhatsAppClient();

// Boot the client – same logic as connectClient() in connect.ts
await new Promise<void>((resolve, reject) => {
	const timer = setTimeout(
		() => reject(new Error('Timed out waiting for WhatsApp (90 s). Is your phone connected?')),
		90_000,
	);

	const done = (fn: () => void) => {
		clearTimeout(timer);
		fn();
	};

	client.once('qr', () => {
		done(() =>
			reject(new Error('Not logged in – run:  wa auth login')),
		);
	});

	client.once('ready', () => {
		done(resolve);
	});

	client.once('error', (err: unknown) => {
		done(() => reject(err instanceof Error ? err : new Error(String(err))));
	});

	client.initialize().catch((err: unknown) => {
		done(() => reject(err));
	});
});

logger.info('WhatsApp client is ready');

// Spin up a TCP server on a random available port
const server = net.createServer(socket => {
	socket.setEncoding('utf8');
	let buf = '';

	socket.on('data', (chunk: string) => {
		buf += chunk;
		const lines = buf.split('\n');
		buf = lines.pop() ?? '';

		for (const line of lines) {
			if (!line.trim()) continue;

			let req: RpcRequest;
			try {
				req = JSON.parse(line) as RpcRequest;
			} catch {
				socket.write(JSON.stringify({id: '?', error: 'Invalid JSON'}) + '\n');
				continue;
			}

			handleRequest(client, server, req)
				.then(resp => {
					if (!socket.destroyed) {
						socket.write(JSON.stringify(resp) + '\n');
					}
				})
				.catch(err => {
					if (!socket.destroyed) {
						socket.write(
							JSON.stringify({id: req.id, error: String(err)}) + '\n',
						);
					}
				});
		}
	});

	socket.on('error', () => {});
});

await new Promise<void>((resolve, reject) => {
	server.listen(0, '127.0.0.1', () => {
		resolve();
	});
	server.once('error', reject);
});

const {port} = server.address() as net.AddressInfo;
const state: DaemonState = {
	pid: process.pid,
	port,
	startedAt: new Date().toISOString(),
	token: SECRET_TOKEN,
};
await writeDaemonState(state);

process.stdout.write(`Daemon ready – port ${port} (pid ${process.pid})\n`);
logger.info(`Daemon listening on 127.0.0.1:${port}`);

// Graceful shutdown on signals
const onSignal = () => {
	void shutdown(client, server, logger);
};
process.once('SIGTERM', onSignal);
process.once('SIGINT', onSignal);
