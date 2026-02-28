import {createContext, useContext} from 'react';
import type {WhatsAppClient} from '../../client.js';

export const ClientContext = createContext<WhatsAppClient | undefined>(
	undefined,
);

export function useClient(): WhatsAppClient {
	const client = useContext(ClientContext);
	if (!client) {
		throw new Error('useClient must be used within a ClientContext.Provider');
	}

	return client;
}
