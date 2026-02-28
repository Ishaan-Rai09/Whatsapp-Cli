import {useState, useEffect} from 'react';
import {WhatsAppClient} from '../../client.js';
import {ConfigManager} from '../../config.js';
import {createContextualLogger} from '../../utils/logger.js';

const logger = createContextualLogger('useWhatsAppClient');

type UseWhatsAppClientResult = {
	client: WhatsAppClient | undefined;
	isLoading: boolean;
	error: string | undefined;
};

export function useWhatsAppClient(): UseWhatsAppClientResult {
	const [client, setClient] = useState<WhatsAppClient | undefined>(undefined);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | undefined>(undefined);

	useEffect(() => {
		const config = ConfigManager.getInstance();
		let wa: WhatsAppClient | undefined;

		const init = async () => {
			await config.initialize();

			if (!config.sessionExists()) {
				setError(
					'No WhatsApp session found. Run `whatsapp-cli login` first to scan the QR code.',
				);
				setIsLoading(false);
				return;
			}

			wa = new WhatsAppClient();

			wa.on('error', (err: Error) => {
				logger.error('Client error', err);
				setError(err.message);
				setIsLoading(false);
			});

			wa.on('ready', () => {
				setClient(wa);
				setIsLoading(false);
			});

			wa.on('disconnected', (reason: string) => {
				setError(`Disconnected: ${reason}`);
			});

			await wa.initialize();
		};

		init().catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			logger.error('Initialization failed', err);
			setError(message);
			setIsLoading(false);
		});

		return () => {
			wa?.destroy().catch(() => {});
		};
	}, []);

	return {client, isLoading, error};
}
