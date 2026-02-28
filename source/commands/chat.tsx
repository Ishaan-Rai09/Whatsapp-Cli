/**
 * This command has been replaced by individual CLI commands.
 * Run `whatsapp-cli --help` to see all available commands.
 */
import React from 'react';
import {Box, Text} from 'ink';

export default function Chat() {
	return (
		<Box flexDirection="column" gap={1}>
			<Text color="yellow">ℹ  The interactive TUI has been replaced with focused CLI commands:</Text>
			<Text>  <Text color="cyan">whatsapp-cli chats</Text>                     — list all chats</Text>
			<Text>  <Text color="cyan">{`whatsapp-cli open "Name"`}</Text>             — read messages</Text>
			<Text>  <Text color="cyan">{`whatsapp-cli send "Name" "hello"`}</Text>     — send a message</Text>
			<Text>  <Text color="cyan">{`whatsapp-cli send "Name" --file a.pdf`}</Text> — send a file</Text>
			<Text>  <Text color="cyan">{`whatsapp-cli reply "Name" 3 "ok!"`}</Text>   — reply to message [3]</Text>
		</Box>
	);
}
