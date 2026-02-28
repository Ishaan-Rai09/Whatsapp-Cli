/**
 * wa chats
 *
 * List all WhatsApp chats, sorted by most recent.
 *
 * Usage:
 *   whatsapp-cli chats
 */
import React, {useState, useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {connectClient} from '../utils/connect.js';
import {formatMessageTime, getMessagePreview} from '../utils/message-parser.js';
import type {WhatsAppClient} from '../client.js';
import type {Thread} from '../types/whatsapp.js';

type State =
	| {phase: 'loading'; status: string}
	| {phase: 'done'; threads: Thread[]}
	| {phase: 'error'; message: string};

export default function Chats() {
	const {exit} = useApp();
	const [state, setState] = useState<State>({
		phase: 'loading',
		status: 'Connecting to WhatsApp…',
	});

	useEffect(() => {
		let client: WhatsAppClient | undefined;
		(async () => {
			try {
				client = await connectClient();
				setState({phase: 'loading', status: 'Loading chats…'});
				const threads = await client.getThreads();
				setState({phase: 'done', threads});
			} catch (err) {
				setState({
					phase: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				client?.destroy().catch(() => {});
			}
		})();
	}, []);

	useEffect(() => {
		if (state.phase !== 'loading') {
			process.exitCode = state.phase === 'error' ? 1 : 0;
			exit();
		}
	}, [state, exit]);

	if (state.phase === 'loading') {
		return <Text dimColor>{state.status}</Text>;
	}

	if (state.phase === 'error') {
		return <Text color="red">✗  {state.message}</Text>;
	}

	const {threads} = state;
	const line = '─'.repeat(72);

	return (
		<Box flexDirection="column">
			<Text dimColor>{line}</Text>
			<Box>
				<Text bold color="cyan">{'  #  '}</Text>
				<Text bold color="cyan">{'     '}</Text>
				<Text bold color="cyan">{'Name                         '}</Text>
				<Text bold color="cyan">{'Unread  '}</Text>
				<Text bold color="cyan">{'Last message'}</Text>
			</Box>
			<Text dimColor>{line}</Text>

			{threads.map((t, i) => {
				const num = String(i + 1).padStart(3);
				const tag = t.isGroup ? ' [G]' : '    ';
				const name = t.name.slice(0, 27).padEnd(28);
				const unread = t.unreadCount > 0 ? `+${t.unreadCount}` : '';
				const preview = getMessagePreview(t.lastMessage).slice(0, 30);
				const time = t.timestamp ? formatMessageTime(t.timestamp) : '';

				return (
					<Box key={t.id}>
						<Text color="cyan">{num} </Text>
						<Text dimColor>{tag} </Text>
						<Text bold={t.unreadCount > 0} color={t.unreadCount > 0 ? 'white' : undefined}>
							{name}
						</Text>
						<Text color="green">{unread.padEnd(8)}</Text>
						<Text dimColor>{preview}</Text>
						{time && <Text dimColor>  [{time}]</Text>}
					</Box>
				);
			})}

			<Text dimColor>{line}</Text>
			<Text dimColor>
				{threads.length} chats   ·   open: whatsapp-cli open {"\"<name>\""}   ·   send: whatsapp-cli send {"\"<name>\""} {"\"<msg>\""}
			</Text>
		</Box>
	);
}
