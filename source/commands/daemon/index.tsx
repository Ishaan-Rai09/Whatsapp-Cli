/**
 * wa daemon
 *
 * Manage the background session daemon that keeps WhatsApp / Puppeteer
 * running between CLI commands, so `wa chats` / `wa send` / etc. respond
 * instantly instead of waiting 15-30 s for Chrome to boot.
 */
import React from 'react';
import {Box, Text} from 'ink';

export default function Daemon() {
	return (
		<Box flexDirection="column" gap={1}>
			<Text bold color="cyan">WhatsApp CLI Daemon</Text>
			<Text dimColor>
				The daemon keeps a single WhatsApp/Puppeteer session alive in the
				background so every command runs in milliseconds.
			</Text>
			<Box flexDirection="column">
				<Text bold>Subcommands:</Text>
				<Text>
					{'  '}
					<Text color="cyan">wa daemon start</Text>
					{'   '}Start the daemon (waits until WhatsApp is ready)
				</Text>
				<Text>
					{'  '}
					<Text color="cyan">wa daemon stop</Text>
					{'    '}Stop the daemon
				</Text>
				<Text>
					{'  '}
					<Text color="cyan">wa daemon status</Text>
					{'  '}Show whether the daemon is running
				</Text>
			</Box>
			<Text dimColor>
				Once the daemon is running, all other commands (chats, send, open,
				reply…) automatically use it — no extra flags needed.
			</Text>
		</Box>
	);
}
