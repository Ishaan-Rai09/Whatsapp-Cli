import React from 'react';
import {Box, Text} from 'ink';
import type {Message, Thread} from '../../types/whatsapp.js';
import {
	formatMessageTime,
	getSenderDisplay,
	getAckStatus,
} from '../../utils/message-parser.js';

type MessageListProperties = {
	readonly messages: Message[];
	readonly currentThread?: Thread;
};

export default function MessageList({
	messages,
	currentThread,
}: MessageListProperties) {
	const renderContent = (message: Message) => {
		switch (message.type) {
			case 'chat': {
				return <Text>{message.body}</Text>;
			}

			case 'image': {
				return (
					<Box flexDirection="column">
						<Text color="cyan">📷 Photo</Text>
						{message.body && (
							<Text dimColor>{message.body}</Text>
						)}
					</Box>
				);
			}

			case 'video': {
				return (
					<Box flexDirection="column">
						<Text color="magenta">🎥 Video</Text>
						{message.body && (
							<Text dimColor>{message.body}</Text>
						)}
					</Box>
				);
			}

			case 'audio': {
				return <Text color="yellow">🎵 Voice/Audio Message</Text>;
			}

			case 'document': {
				const filename =
					'filename' in message && message.filename
						? message.filename
						: 'Document';
				return (
					<Box flexDirection="column">
						<Text color="blue">📄 {filename}</Text>
						{message.body && (
							<Text dimColor>{message.body}</Text>
						)}
					</Box>
				);
			}

			case 'sticker': {
				return <Text>🎨 Sticker</Text>;
			}

			case 'location': {
				const loc = message.location;
				return (
					<Box flexDirection="column">
						<Text color="green">📍 Location</Text>
						{loc.description && <Text dimColor>{loc.description}</Text>}
						<Text dimColor>
							{loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
						</Text>
					</Box>
				);
			}

			case 'revoked': {
				return <Text dimColor italic>🚫 This message was deleted</Text>;
			}

			default: {
				const body = 'body' in message ? (message.body as string) : '';
				return <Text dimColor>{body || '💬 Message'}</Text>;
			}
		}
	};

	if (messages.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text dimColor>No messages yet. Say something!</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column" flexGrow={1} overflowY="hidden">
			{messages.map((message, _index) => {
				const sender = getSenderDisplay(message, currentThread);
				const time = formatMessageTime(message.timestamp);
				const ack = message.fromMe ? getAckStatus(message.ack) : '';
				const isRead = message.fromMe && message.ack === 3;

				return (
					<Box
						key={message.id}
						flexDirection="column"
						marginY={0}
						paddingX={1}
						alignItems={message.fromMe ? 'flex-end' : 'flex-start'}
					>
						{/* Sender + time header */}
						<Box>
							<Text
								bold
								color={message.fromMe ? 'green' : 'cyan'}
							>
								{sender}
							</Text>
							<Text dimColor>  {time}</Text>
							{ack && (
								<Text color={isRead ? 'blue' : 'gray'}> {ack}</Text>
							)}
						</Box>

						{/* Message bubble */}
						<Box
							borderStyle="round"
							borderColor={message.fromMe ? 'green' : 'gray'}
							paddingX={1}
							marginBottom={1}
						>
							{renderContent(message)}
						</Box>
					</Box>
				);
			})}
		</Box>
	);
}
