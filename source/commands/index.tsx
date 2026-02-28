import React from 'react';
import {Box, Text} from 'ink';
import BigText from 'ink-big-text';
import Gradient from 'ink-gradient';

export default function Index() {
	return (
		<Box flexDirection="column" padding={1}>
			<Gradient name="summer">
				<BigText text="WhatsApp CLI" font="tiny" />
			</Gradient>
			<Box marginTop={1} flexDirection="column" gap={1}>
				<Text bold color="green">
					A terminal-based WhatsApp client — no API key required.
				</Text>
				<Text dimColor>
					Uses WhatsApp Web under the hood (puppeteer).
				</Text>
				<Box marginTop={1} flexDirection="column">
					<Text bold>Commands:</Text>
					<Text dimColor>  First time setup:</Text>
					<Text>    <Text color="cyan">auth login</Text>                           Scan QR to connect your account</Text>
					<Text dimColor>  Speed up all commands (recommended):</Text>
					<Text>    <Text color="cyan">daemon start</Text>                         Start background session daemon</Text>
					<Text>    <Text color="cyan">daemon stop</Text>                          Stop the daemon</Text>
					<Text>    <Text color="cyan">daemon status</Text>                        Check daemon status</Text>
					<Text dimColor>  Chats:</Text>
					<Text>    <Text color="cyan">chats</Text>                                List all chats</Text>
					<Text>    <Text color="cyan">{`open "Name" [--limit N]`}</Text>          Show last N messages</Text>
					<Text>    <Text color="cyan">{`send "Name" "message"`}</Text>            Send a text message</Text>
					<Text>    <Text color="cyan">{`send "Name" --file path [caption]`}</Text> Send image / PDF / zip / …</Text>
					<Text>    <Text color="cyan">{`reply "Name" <index> "message"`}</Text>   Reply to a specific message</Text>
					<Text dimColor>  Session:</Text>
					<Text>    <Text color="cyan">auth logout</Text>                          Remove saved session</Text>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>Run </Text>
					<Text color="green">whatsapp-cli --help</Text>
					<Text dimColor> for more information.</Text>
				</Box>
			</Box>
		</Box>
	);
}
