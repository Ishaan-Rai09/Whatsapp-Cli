// ─── Chat / Thread Types ───────────────────────────────────────────────────

export type Thread = {
	id: string;
	name: string;
	isGroup: boolean;
	lastMessage?: Message;
	unreadCount: number;
	timestamp?: Date;
	/** Group participants or individual phone number */
	participants?: Participant[];
	profilePic?: string;
};

export type Participant = {
	id: string;
	name: string;
	isAdmin?: boolean;
};

// ─── Message Types ─────────────────────────────────────────────────────────

export type MessageType =
	| 'chat'
	| 'image'
	| 'video'
	| 'audio'
	| 'document'
	| 'sticker'
	| 'location'
	| 'vcard'
	| 'revoked'
	| 'unknown';

type BaseMessage = {
	id: string;
	timestamp: Date;
	fromMe: boolean;
	from: string;
	to: string;
	threadId: string;
	senderName?: string;
	hasQuotedMsg?: boolean;
	quotedMsg?: QuotedMessage;
	ack?: number; // delivery status: -1 error, 0 pending, 1 sent, 2 delivered, 3 read
};

export type TextMessage = BaseMessage & {
	type: 'chat';
	body: string;
};

export type MediaMessage = BaseMessage & {
	type: 'image' | 'video' | 'audio' | 'document' | 'sticker';
	body: string; // caption
	hasMedia: true;
	mediaUrl?: string;
	mimetype?: string;
	filename?: string;
};

export type LocationMessage = BaseMessage & {
	type: 'location';
	location: {
		latitude: number;
		longitude: number;
		description?: string;
	};
};

export type RevokedMessage = BaseMessage & {
	type: 'revoked';
	body: string;
};

export type UnknownMessage = BaseMessage & {
	type: 'unknown';
	body: string;
};

export type Message =
	| TextMessage
	| MediaMessage
	| LocationMessage
	| RevokedMessage
	| UnknownMessage;

export type QuotedMessage = {
	id: string;
	body: string;
	type: MessageType;
	fromMe: boolean;
	senderName?: string;
};

// ─── Chat State ────────────────────────────────────────────────────────────

export type ChatState = {
	threads: Thread[];
	messages: Message[];
	loading: boolean;
	loadingMoreThreads: boolean;
	currentThread: Thread | undefined;
	recipientAlreadyRead: boolean;
};

// ─── Connection Status ─────────────────────────────────────────────────────

export type ConnectionStatus =
	| 'disconnected'
	| 'initializing'
	| 'qr'
	| 'authenticated'
	| 'ready'
	| 'error';
