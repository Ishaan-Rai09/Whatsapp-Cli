import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import Fuse from 'fuse.js';
import {ConfigManager} from './config.js';
import {createContextualLogger} from './utils/logger.js';
import type {
	Thread,
	Message,
	TextMessage,
	MediaMessage,
	LocationMessage,
	RevokedMessage,
	UnknownMessage,
	Participant,
	ConnectionStatus,
} from './types/whatsapp.js';

// whatsapp-web.js is a CommonJS module — load it via createRequire so the
// ESM runtime doesn't try to resolve named exports that don't exist.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const wwebjs = _require('whatsapp-web.js') as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
const {Client, LocalAuth, MessageMedia} = wwebjs;

export type SearchResult = {
	thread: Thread;
	score: number;
};

export type {ConnectionStatus};

// ─── WhatsApp Client ──────────────────────────────────────────────────────

// eslint-disable-next-line unicorn/prefer-event-target
export class WhatsAppClient extends EventEmitter {
	private readonly logger = createContextualLogger('WhatsAppClient');

	// The underlying whatsapp-web.js client instance (typed as any to avoid CJS type issues)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private waClient: any;

	private _status: ConnectionStatus = 'disconnected';
	private _myId = '';
	private _myName = '';

	// Cached threads (chats)
	private threadsCache: Thread[] = [];

	constructor() {
		super();

		const config = ConfigManager.getInstance();
		const authDir = config.get('advanced.authDir') as string;

		this.waClient = new Client({
			authStrategy: new LocalAuth({
				clientId: 'default',
				dataPath: authDir,
			}),
			puppeteer: {
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--disable-dev-shm-usage',
					'--disable-accelerated-2d-canvas',
					'--no-first-run',
					'--no-zygote',
					'--disable-gpu',
				],
			},
		});

		this.setupListeners();
	}

	// ── Connection ────────────────────────────────────────────────────────

	public async initialize(): Promise<void> {
		this.setStatus('initializing');
		await this.waClient.initialize();
	}

	public async destroy(): Promise<void> {
		try {
			await this.waClient.destroy();
		} catch (error) {
			// TargetCloseError is expected — puppeteer browser already shut down
			const msg = error instanceof Error ? error.message : String(error);
			if (!msg.includes('TargetCloseError') && !msg.includes('Target closed') && !msg.includes('Protocol error')) {
				this.logger.error('Error destroying client', error);
			}
		}

		this.setStatus('disconnected');
	}

	public get status(): ConnectionStatus {
		return this._status;
	}

	public get myId(): string {
		return this._myId;
	}

	public get myName(): string {
		return this._myName;
	}

	// ── Threads ───────────────────────────────────────────────────────────

	public async getThreads(): Promise<Thread[]> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chats = await this.waClient.getChats() as any[];

			// Use allSettled so a single bad chat doesn't crash the whole list
			const results = await Promise.allSettled(
				chats.map(async (chat: any) => this.parseChat(chat)),
			);

			this.threadsCache = results
				.filter((r): r is PromiseFulfilledResult<Thread> => r.status === 'fulfilled')
				.map(r => r.value);

			// Log skipped chats for debugging
			const failed = results.filter(r => r.status === 'rejected');
			if (failed.length > 0) {
				this.logger.warn(`Skipped ${failed.length} chats that failed to parse`);
			}

			return this.threadsCache;
		} catch (error) {
			this.logger.error('getThreads failed', error);
			throw error;
		}
	}

	public async searchThreads(query: string): Promise<SearchResult[]> {
		let threads = this.threadsCache;
		if (threads.length === 0) {
			threads = await this.getThreads();
		}

		if (!query.trim()) {
			return threads.map(t => ({thread: t, score: 1}));
		}

		const fuse = new Fuse(threads, {
			keys: ['name'],
			includeScore: true,
			threshold: 0.4,
		});

		return fuse.search(query).map(result => ({
			thread: result.item,
			score: result.score ?? 1,
		}));
	}

	// ── Messages ──────────────────────────────────────────────────────────

	public async getMessages(chatId: string, limit = 50): Promise<Message[]> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chat = await this.waClient.getChatById(chatId);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const msgs = await chat.fetchMessages({limit});
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
			return msgs.map((m: any) => this.parseMessage(m, chatId));
		} catch (error) {
			this.logger.error('getMessages failed', error);
			throw error;
		}
	}

	public async sendMessage(chatId: string, text: string): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chat = await this.waClient.getChatById(chatId);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			await chat.sendMessage(text);
		} catch (error) {
			this.logger.error('sendMessage failed', error);
			throw error;
		}
	}

	/** Send an image from a local file path */
	public async sendImage(chatId: string, filePath: string, caption = ''): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chat = await this.waClient.getChatById(chatId);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const media = MessageMedia.fromFilePath(filePath);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			await chat.sendMessage(media, {caption});
		} catch (error) {
			this.logger.error('sendImage failed', error);
			throw error;
		}
	}

	/**
	 * Find a chat by display name — exact match, then partial, then fuzzy.
	 * Loads the thread cache first if it's empty.
	 */
	public async findChatByName(name: string): Promise<Thread | undefined> {
		let threads = this.threadsCache;
		if (threads.length === 0) threads = await this.getThreads();

		const lower = name.toLowerCase();

		// 1. Exact (case-insensitive)
		const exact = threads.find(t => t.name.toLowerCase() === lower);
		if (exact) return exact;

		// 2. Partial
		const partial = threads.find(t => t.name.toLowerCase().includes(lower));
		if (partial) return partial;

		// 3. Fuzzy via Fuse.js
		const results = await this.searchThreads(name);
		return results[0]?.thread;
	}

	/**
	 * Send any file (image, video, audio, PDF, ZIP, …) to a chat.
	 * Images/video/audio are sent as media; everything else as a document.
	 */
	public async sendFile(chatId: string, filePath: string, caption = ''): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chat = await this.waClient.getChatById(chatId);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const media = MessageMedia.fromFilePath(filePath);
			const mime: string = (media.mimetype as string | undefined) ?? '';
			const isInlineMedia =
				mime.startsWith('image/') ||
				mime.startsWith('video/') ||
				mime.startsWith('audio/');
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			await chat.sendMessage(media, {
				caption,
				sendMediaAsDocument: !isInlineMedia,
			});
		} catch (error) {
			this.logger.error('sendFile failed', error);
			throw error;
		}
	}

	/**
	 * Reply to a specific message by its WhatsApp serialized ID.
	 */
	public async replyToMessage(messageId: string, text: string): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const msg = await this.waClient.getMessageById(messageId);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			await msg.reply(text);
		} catch (error) {
			this.logger.error('replyToMessage failed', error);
			throw error;
		}
	}

	/** Mark a chat as read */
	public async markAsRead(chatId: string): Promise<void> {
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			const chat = await this.waClient.getChatById(chatId);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
			await chat.sendSeen();
		} catch (error) {
			this.logger.error('markAsRead failed', error);
		}
	}

	// ── Internal Listeners ────────────────────────────────────────────────

	private setupListeners(): void {
		// QR code ready to display
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.waClient.on('qr', (qr: string) => {
			this.setStatus('qr');
			this.emit('qr', qr);
		});

		// Session authenticated (no QR needed on subsequent starts)
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.waClient.on('authenticated', () => {
			this.setStatus('authenticated');
			this.emit('authenticated');
		});

		// Client is fully ready to use
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.waClient.on('ready', async () => {
			this.setStatus('ready');
			// Grab own info
			try {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
				const info = this.waClient.info;
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				this._myId = (info?.wid?._serialized as string | undefined) ?? '';
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				this._myName = (info?.pushname as string | undefined) ?? '';
			} catch {}

			this.emit('ready');
		});

		// Incoming message from others
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		this.waClient.on('message', (msg: any) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const thread: Thread | undefined = this.threadsCache.find(
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				t => t.id === (msg.from as string),
			);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const threadId = (msg.from as string) ?? '';
			const parsed = this.parseMessage(msg, threadId);
			this.emit('message', parsed, thread);
		});

		// Outgoing message created by us
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
		this.waClient.on('message_create', (msg: any) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (!(msg.fromMe as boolean)) return; // avoid duplicate for incoming
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const threadId = (msg.to as string) ?? '';
			const parsed = this.parseMessage(msg, threadId);
			this.emit('message_create', parsed);
		});

		// Disconnected
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.waClient.on('disconnected', (reason: string) => {
			this.setStatus('disconnected');
			this.emit('disconnected', reason);
		});

		// Auth failure
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		this.waClient.on('auth_failure', (message: string) => {
			this.setStatus('error');
			this.emit('error', new Error(`Auth failure: ${message}`));
		});
	}

	// ── Parsers ───────────────────────────────────────────────────────────

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private async parseChat(chat: any): Promise<Thread> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const rawId = (chat?.id?._serialized ?? chat?.id) as string | undefined;
		if (!rawId) throw new Error('Chat has no serialized ID');

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const rawName = (chat?.name ?? chat?.formattedTitle ?? rawId) as string;

		let lastMsg: Message | undefined;
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (chat.lastMessage) {
				lastMsg = this.parseMessage(chat.lastMessage, rawId);
			}
		} catch {}

		let participants: Participant[] | undefined;
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			if (chat.isGroup) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any
				participants = (chat.participants as any[])?.map((p: any) => ({
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					id: (p?.id?._serialized ?? '') as string,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					name: (p?.name ?? p?.pushname ?? '') as string,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					isAdmin: Boolean(p?.isAdmin),
				}));
			}
		} catch {}

		return {
			id: rawId,
			name: rawName,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			isGroup: Boolean(chat.isGroup),
			lastMessage: lastMsg,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			unreadCount: ((chat.unreadCount as number | undefined) ?? 0),
			timestamp: lastMsg?.timestamp,
			participants,
		};
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private parseMessage(msg: any, threadId: string): Message {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const type = msg.type as string;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const fromMe = Boolean(msg.fromMe);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const from = (msg.from as string) ?? '';
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const to = (msg.to as string) ?? '';
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const body = (msg.body as string) ?? '';
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const timestamp = new Date(((msg.timestamp as number) ?? 0) * 1000);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const ack = msg.ack as number | undefined;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const senderName = msg._data?.notifyName as string | undefined;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const idSerialized = msg.id?._serialized as string | undefined ?? `${from}-${timestamp.getTime()}`;

		const base = {
			id: idSerialized,
			timestamp,
			fromMe,
			from,
			to,
			threadId,
			senderName,
			ack,
		};

		if (type === 'chat') {
			return {...base, type: 'chat', body} as TextMessage;
		}

		if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
			return {
				...base,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				type: type as MediaMessage['type'],
				body,
				hasMedia: true,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				mimetype: msg.mimetype as string | undefined,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
				filename: msg._data?.filename as string | undefined,
			} as MediaMessage;
		}

		if (type === 'location') {
			return {
				...base,
				type: 'location',
				location: {
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					latitude: msg.location?.latitude as number ?? 0,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					longitude: msg.location?.longitude as number ?? 0,
					// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
					description: msg.location?.description as string | undefined,
				},
			} as LocationMessage;
		}

		if (type === 'revoked') {
			return {...base, type: 'revoked', body: '🚫 This message was deleted'} as RevokedMessage;
		}

		return {...base, type: 'unknown', body} as UnknownMessage;
	}

	private setStatus(status: ConnectionStatus): void {
		this._status = status;
		this.emit('status', status);
	}
}
