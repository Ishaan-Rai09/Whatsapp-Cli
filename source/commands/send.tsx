/**
 * wa send "<chat name>" "<message>"
 * wa send "<chat name>" --file /path/to/file [caption words...]
 *
 * Send a text message or a file to any chat.
 * Supports images, videos, audio, PDFs, ZIPs, and any other file type.
 *
 * Usage:
 *   whatsapp-cli send "Alex" "Hey what's up!"
 *   whatsapp-cli send "Dev Team" "Check this out" --file ~/report.pdf
 *   whatsapp-cli send "Sara" --file ~/photo.jpg "Taken today"
 */
import React, {useState, useEffect} from 'react';
import {Text, useApp} from 'ink';
import {option} from 'pastel';
import zod from 'zod';
import path from 'node:path';
import {connectClient} from '../utils/connect.js';
import type {ClientHandle} from '../utils/connect.js';

export const args = zod
	.tuple([zod.string().describe('Chat name (full or partial match)')])
	.rest(zod.string().describe('Message text (or caption when --file is used)'));

export const options = zod.object({
	file: zod
		.string()
		.optional()
		.describe(
			option({
				alias: 'f',
				description: 'Path to file to send (image, pdf, zip, video, audio…)',
			}),
		),
});

type Props = {
	readonly args: [string, ...string[]];
	readonly options: {file?: string};
};

type State =
	| {phase: 'loading'; status: string}
	| {phase: 'done'; result: string}
	| {phase: 'error'; message: string};

export default function Send({
	args: [chatName, ...bodyParts],
	options: {file},
}: Props) {
	const {exit} = useApp();
	const [state, setState] = useState<State>({
		phase: 'loading',
		status: 'Connecting to WhatsApp…',
	});

	const bodyText = bodyParts.join(' ');

	useEffect(() => {
		let client: ClientHandle | undefined;
		(async () => {
			try {
				if (!file && !bodyText) {
					setState({
						phase: 'error',
						message: 'Nothing to send. Provide a message or use --file <path>',
					});
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

				if (file) {
					const absPath = path.resolve(file);
					const fileName = path.basename(absPath);
					setState({phase: 'loading', status: `Sending ${fileName} to ${thread.name}…`});
					await client.sendFile(thread.id, absPath, bodyText);
					setState({phase: 'loading', status: 'Waiting for WhatsApp to confirm…'});
					await new Promise(r => setTimeout(r, 3000));
					setState({
						phase: 'done',
						result: `✓  Sent ${fileName} → ${thread.name}`,
					});
				} else {
					setState({phase: 'loading', status: `Sending message to ${thread.name}…`});
					await client.sendMessage(thread.id, bodyText);
					setState({phase: 'loading', status: 'Waiting for WhatsApp to confirm…'});
					await new Promise(r => setTimeout(r, 2500));
					setState({
						phase: 'done',
						result: `✓  Message sent → ${thread.name}`,
					});
				}
			} catch (err) {
				setState({
					phase: 'error',
					message: err instanceof Error ? err.message : String(err),
				});
			} finally {
				await client?.destroy().catch(() => {});
			}
		})();
	// exhaustive deps intentionally omitted – these values never change during a command run
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
