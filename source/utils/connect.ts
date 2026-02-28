import {WhatsAppClient} from '../client.js';

/**
 * Boot the WhatsApp client and wait until it is fully ready.
 *
 * Rejects when:
 *  - A QR code is emitted (not logged in)
 *  - An auth failure / error event fires
 *  - 90 seconds elapse without a 'ready' event
 */
export async function connectClient(): Promise<WhatsAppClient> {
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
