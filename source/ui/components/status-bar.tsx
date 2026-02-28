import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/whatsapp.js';
import type {ConnectionStatus} from '../../client.js';

type StatusBarProperties = {
	readonly isLoading: boolean;
	readonly error?: string;
	readonly currentView: 'threads' | 'chat';
	readonly currentThread?: Thread;
	readonly connectionStatus: ConnectionStatus;
	readonly myName?: string;
};

export default function StatusBar({
	isLoading,
	error,
	currentView,
	currentThread,
	connectionStatus,
	myName,
}: StatusBarProperties) {
	const statusIndicator = () => {
		switch (connectionStatus) {
			case 'ready': {
				return <Text color="green"> ● Connected</Text>;
			}

			case 'initializing':
			case 'authenticated': {
				return <Text color="yellow"> ● Connecting…</Text>;
			}

			case 'qr': {
				return <Text color="yellow"> ● Awaiting QR scan</Text>;
			}

			case 'error': {
				return <Text color="red"> ✗ Error</Text>;
			}

			default: {
				return <Text color="gray"> ○ Disconnected</Text>;
			}
		}
	};

	return (
		<Box paddingX={1} justifyContent="space-between" width="100%">
			<Box gap={1}>
				<Text bold color="green">
					💬 WhatsApp CLI
				</Text>
				{statusIndicator()}
				{currentView === 'chat' && currentThread && (
					<Text>
						{' '}
						/{' '}
						<Text bold>
							{currentThread.isGroup ? '👥 ' : ''}
							{currentThread.name}
						</Text>
					</Text>
				)}
			</Box>
			<Box gap={1}>
				{myName && <Text dimColor>{myName}</Text>}
				{isLoading && <Text color="yellow">Loading…</Text>}
				{error && (
					<Text color="red">⚠ {error.length > 60 ? error.slice(0, 57) + '…' : error}</Text>
				)}
				{!isLoading && !error && (
					<Text color="green">
						{currentView === 'threads' ? 'Chats' : 'Chat'}
					</Text>
				)}
				<Text dimColor>  [q] quit  [/] search  [ESC] back</Text>
			</Box>
		</Box>
	);
}
