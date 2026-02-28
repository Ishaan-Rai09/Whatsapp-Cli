import React from 'react';
import {Box, Text} from 'ink';
import type {Thread} from '../../types/whatsapp.js';
import {getMessagePreview} from '../../utils/message-parser.js';

type ThreadItemProperties = {
	readonly thread: Thread;
	readonly isSelected: boolean;
};

export default function ThreadItem({thread, isSelected}: ThreadItemProperties) {
	const preview = getMessagePreview(thread.lastMessage);

	// Format time
	const timeStr = thread.timestamp
		? thread.timestamp.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			})
		: '';

	const name = thread.isGroup
		? `👥 ${thread.name}`
		: thread.name;

	return (
		<Box
			flexDirection="column"
			borderStyle={isSelected ? 'bold' : 'single'}
			borderColor={isSelected ? 'green' : 'gray'}
			paddingX={1}
			flexShrink={0}
		>
			<Box justifyContent="space-between">
				<Text
					bold={isSelected}
					color={isSelected ? 'green' : undefined}
					wrap="truncate"
				>
					{name}
				</Text>
				<Box>
					{thread.unreadCount > 0 && (
						<Text color="green" bold>
							{' '}
							({thread.unreadCount})
						</Text>
					)}
					<Text dimColor> {timeStr}</Text>
				</Box>
			</Box>
			<Text dimColor wrap="truncate">
				{preview || ' '}
			</Text>
		</Box>
	);
}
