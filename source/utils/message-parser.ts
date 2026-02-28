import type {Message, Thread} from '../types/whatsapp.js';

/**
 * Format a timestamp for display in the chat UI.
 */
export function formatMessageTime(date: Date): string {
	const now = new Date();
	const isToday =
		date.getDate() === now.getDate() &&
		date.getMonth() === now.getMonth() &&
		date.getFullYear() === now.getFullYear();

	if (isToday) {
		return date.toLocaleTimeString('en-US', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	return date.toLocaleDateString('en-US', {
		day: '2-digit',
		month: '2-digit',
		year: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	});
}

/**
 * Get a short preview string for a message (used in thread list).
 */
export function getMessagePreview(message: Message | undefined): string {
	if (!message) return '';

	const prefix = message.fromMe ? 'You: ' : '';

	switch (message.type) {
		case 'chat': {
			const body = message.body ?? '';
			return prefix + (body.length > 40 ? body.slice(0, 40) + '…' : body);
		}

		case 'image': {
			return prefix + '📷 Photo';
		}

		case 'video': {
			return prefix + '🎥 Video';
		}

		case 'audio': {
			return prefix + '🎵 Audio';
		}

		case 'document': {
			return (
				prefix +
				('filename' in message && message.filename
					? `📄 ${message.filename}`
					: '📄 Document')
			);
		}

		case 'sticker': {
			return prefix + '🎨 Sticker';
		}

		case 'location': {
			return prefix + '📍 Location';
		}

		case 'revoked': {
			return '🚫 Message deleted';
		}

		default: {
			return prefix + '💬 Message';
		}
	}
}

/**
 * Sort threads by most recent activity (timestamp descending).
 */
export function sortThreadsByRecency(threads: Thread[]): Thread[] {
	return [...threads].sort((a, b) => {
		const aTime = a.timestamp?.getTime() ?? 0;
		const bTime = b.timestamp?.getTime() ?? 0;
		return bTime - aTime;
	});
}

/**
 * Get the display name for a message sender relative to the current thread.
 */
export function getSenderDisplay(
	message: Message,
	currentThread: Thread | undefined,
): string {
	if (message.fromMe) return 'You';
	if (message.senderName) return message.senderName;

	// Strip @c.us / @g.us suffix from id
	return message.from.replace(/@[cg]\.us$/, '');
}

/**
 * Get the ACK status indicator text.
 * -1 = error, 0 = pending, 1 = sent, 2 = delivered, 3 = read
 */
export function getAckStatus(ack: number | undefined): string {
	switch (ack) {
		case -1: { return '✗'; }
		case 0: { return '○'; }
		case 1: { return '✓'; }
		case 2: { return '✓✓'; }
		case 3: { return '✓✓'; } // same symbol, caller can color it blue
		default: { return ''; }
	}
}
