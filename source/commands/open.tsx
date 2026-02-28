/**
 * wa open "<chat name>" [--limit N]
 *
 * Show the last N messages from a chat.
 * Message indices shown can be used with `wa reply`.
 *
 * Usage:
 *   whatsapp-cli open "Alex"
 *   whatsapp-cli open "Dev Team" --limit 50
 */
import React, {useState, useEffect} from 'react';
import {Box, Text, useApp} from 'ink';
import {option} from 'pastel';
import zod from 'zod';
import {connectClient} from '../utils/connect.js';
import {formatMessageTime, getMessagePreview} from '../utils/message-parser.js';
import type {WhatsAppClient} from '../client.js';
import type {Thread, Message} from '../types/whatsapp.js';

export const args = zod.tuple([
	zod.string().describe('Chat name (full or partial match)'),
]);

export const options = zod.object({
	limit: zod
		.number()
		.default(20)
		.describe(
			option({
				alias: 'n',
				description: 'Number of messages to fetch (default: 20)',
			}),
		),
});

type Props = {
	readonly args: [string];
	readonly options: {limit: number};
};

type State =
	| {phase: 'loading'; status: string}
	| {phase: 'done'; thread: Thread; messages: Message[]}
	| {phase: 'error'; message: string};

export default function Open({
	args: [chatName],
	options: {limit},
}: Props) {
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
				setState({phase: 'loading', status: `Searching for "${chatName}"…`});

				const thread = await client.findChatByName(chatName);
				if (!thread) {
					setState({
						phase: 'error',
						message: `No chat found matching "${chatName}". Run: whatsapp-cli chats`,
					});
					return;
				}

				setState({phase: 'loading', status: `Loading messages from ${thread.name}…`});
				const messages = await client.getMessages(thread.id, limit);
				setState({phase: 'done', thread, messages});
			} catch (err) {
				setState({
					phase: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				client?.destroy().catch(() => {});
			}
		})();
	}, [chatName, limit]);

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

	const {thread, messages} = state;
	const bar = '─'.repeat(72);
	const title = `${thread.isGroup ? '[G] ' : ''}${thread.name}`;

	return (
		<Box flexDirection="column">
			<Text bold color="green">
				{'── '}{title}{' '}{'─'.repeat(Math.max(0, 67 - title.length))}{` ${messages.length} msgs ──`}
			</Text>

			{messages.map((msg, i) => {
				const idx = `[${i + 1}]`.padEnd(5);
				const time = formatMessageTime(msg.timestamp);
				const sender = msg.fromMe
					? 'You'
					: (thread.isGroup
						? (msg.senderName ?? '?').slice(0, 14)
						: thread.name.slice(0, 14));
				const preview = getMessagePreview(msg);

				return (
					<Box key={msg.id}>
						<Text color="cyan">{idx}</Text>
						<Text dimColor>  {time}  </Text>
						<Text color={msg.fromMe ? 'green' : 'yellow'}>
							{sender.padEnd(15)}
						</Text>
						<Text>  {preview}</Text>
					</Box>
				);
			})}

			<Text dimColor>{bar}</Text>
			<Text dimColor>
				{'Reply: whatsapp-cli reply "'}{thread.name}{'" <index> "your message"'}
			</Text>
		</Box>
	);
}
