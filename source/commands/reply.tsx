/**
 * wa reply "<chat name>" <message-index> "<reply text>"
 *
 * Reply to a specific message in a chat.
 * Use `whatsapp-cli open` to see the message indices.
 *
 * Usage:
 *   whatsapp-cli open "Alex"             # see messages with [1] [2] [3]...
 *   whatsapp-cli reply "Alex" 3 "Sure, see you then!"
 *   whatsapp-cli reply "Dev Team" 7 Yes I will attend
 */
import React, {useState, useEffect} from 'react';
import {Text, useApp} from 'ink';
import zod from 'zod';
import {connectClient} from '../utils/connect.js';
import type {WhatsAppClient} from '../client.js';

export const args = zod
	.tuple([
		zod.string().describe('Chat name (full or partial match)'),
		zod.string().describe('Message index shown by whatsapp-cli open'),
	])
	.rest(zod.string().describe('Reply text'));

type Props = {
	readonly args: [string, string, ...string[]];
};

type State =
	| {phase: 'loading'; status: string}
	| {phase: 'done'; result: string}
	| {phase: 'error'; message: string};

export default function Reply({args: [chatName, indexStr, ...replyParts]}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>({
		phase: 'loading',
		status: 'Connecting to WhatsApp…',
	});

	const replyText = replyParts.join(' ');
	const msgIndex = Number.parseInt(indexStr, 10);

	useEffect(() => {
		let client: WhatsAppClient | undefined;
		(async () => {
			try {
				if (!replyText) {
					setState({phase: 'error', message: 'Provide the reply text after the message index'});
					return;
				}

				if (Number.isNaN(msgIndex) || msgIndex < 1) {
					setState({phase: 'error', message: `"${indexStr}" is not a valid message index. Use a number ≥ 1`});
					return;
				}

				client = await connectClient();
				setState({phase: 'loading', status: `Finding "${chatName}"…`});

				const thread = await client.findChatByName(chatName);
				if (!thread) {
					setState({
						phase: 'error',
						message: `No chat found matching "${chatName}". Run: whatsapp-cli chats`,
					});
					return;
				}

				// Fetch enough messages to cover the requested index
				const fetchCount = Math.max(msgIndex, 20);
				setState({phase: 'loading', status: `Fetching messages from ${thread.name}…`});
				const messages = await client.getMessages(thread.id, fetchCount);

				const target = messages[msgIndex - 1];
				if (!target) {
					setState({
						phase: 'error',
						message: `No message at index ${msgIndex} (only ${messages.length} messages fetched). Try whatsapp-cli open "${chatName}" --limit ${fetchCount + 20}`,
					});
					return;
				}

				setState({phase: 'loading', status: 'Sending reply…'});
				await client.replyToMessage(target.id, replyText);
				setState({phase: 'loading', status: 'Waiting for WhatsApp to confirm…'});
				await new Promise(r => setTimeout(r, 2500));
				setState({
					phase: 'done',
					result: `✓  Replied to [${msgIndex}] in ${thread.name}`,
				});
			} catch (err) {
				setState({
					phase: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				await client?.destroy().catch(() => {});
			}
		})();
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (state.phase !== 'loading') {
			process.exitCode = state.phase === 'error' ? 1 : 0;
			exit();
		}
	}, [state, exit]);

	if (state.phase === 'loading') return <Text dimColor>{state.status}</Text>;
	if (state.phase === 'error') return <Text color="red">✗  {state.message}</Text>;
	return <Text color="green">{state.result}</Text>;
}
