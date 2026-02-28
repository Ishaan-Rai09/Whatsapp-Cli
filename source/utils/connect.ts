import {WhatsAppClient} from '../client.js';
import {IpcClient, tryConnectDaemon} from './ipc.js';

/**
 * Unified handle returned by connectClient().
 * Either a live WhatsAppClient (direct Puppeteer) or an IpcClient
 * (proxy to the running daemon).  Both implement the same public API.
 */
export type ClientHandle = WhatsAppClient | IpcClient;

/**
 * Boot the WhatsApp client and wait until it is fully ready.
 *
 * Fast path: if the daemon is running (`wa daemon start`) this returns
 * an IPC proxy in ~1 ms instead of launching a new Chrome instance.
 *
 * Slow path (no daemon): spawns Puppeteer and waits up to 90 seconds
 * for WhatsApp Web to authenticate.
 *
 * Rejects when:
 *  - A QR code is emitted (not logged in)
 *  - An auth failure / error event fires
 *  - 90 seconds elapse without a 'ready' event
 */
export async function connectClient(): Promise<ClientHandle> {
	// ── Fast path: reuse an already-running daemon ──────────────────────
	const daemon = await tryConnectDaemon();
	if (daemon) return daemon;

	// ── Slow path: boot a fresh WhatsApp client ─────────────────────────
	const client = new WhatsAppClient();

	await new Promise<void>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new Error('Timed out waiting for WhatsApp (90 s). Is your phone connected?')),
			90_000,
		);

		const cleanup = () => clearTimeout(timer);

		client.once('qr', () => {
			cleanup();
			reject(new Error('Not logged in. Run:  whatsapp-cli auth login'));
		});

		client.once('ready', () => {
			cleanup();
			resolve();
		});

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		client.once('error', (err: any) => {
			cleanup();
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
			reject(err instanceof Error ? err : new Error(String(err)));
		});

		client.initialize().catch((err: unknown) => {
			cleanup();
			reject(err);
		});
	});

	return client;
}
