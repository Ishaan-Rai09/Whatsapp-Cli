import React, {useState, useEffect, useRef, useCallback} from 'react';
import {Box, Text, useInput, useApp} from 'ink';
import type {Thread, Message, ChatState} from '../../types/whatsapp.js';
import type {ConnectionStatus} from '../../client.js';
import {useClient} from '../context/client-context.js';
import {useScreenSize} from '../hooks/use-screen-size.js';
import ThreadList from '../components/thread-list.js';
import MessageList from '../components/message-list.js';
import InputBox from '../components/input-box.js';
import StatusBar from '../components/status-bar.js';
import FullScreen from '../components/full-screen.js';
import TextInput from 'ink-text-input';

type ChatViewProps = {
	readonly initialSearchQuery?: string;
};

export default function ChatView({initialSearchQuery}: ChatViewProps) {
	const {exit} = useApp();
	const client = useClient();
	const {height, width} = useScreenSize();

	// ── State ────────────────────────────────────────────────────────────

	const [chatState, setChatState] = useState<ChatState>({
		threads: [],
		messages: [],
		loading: true,
		loadingMoreThreads: false,
		currentThread: undefined,
		recipientAlreadyRead: false,
	});

	const [currentView, setCurrentView] = useState<'threads' | 'chat'>('threads');
	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>('ready');
	const [systemMessage, setSystemMessage] = useState<string | undefined>(
		undefined,
	);
	const [error, setError] = useState<string | undefined>(undefined);

	// Search state
	const [isSearching, setIsSearching] = useState(false);
	const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? '');
	const [searchResults, setSearchResults] = useState<Thread[]>([]);

	// Auto-clear system messages
	useEffect(() => {
		if (!systemMessage) return;
		const t = setTimeout(() => setSystemMessage(undefined), 3000);
		return () => clearTimeout(t);
	}, [systemMessage]);

	// ── Load Initial Threads ─────────────────────────────────────────────

	useEffect(() => {
		const loadThreads = async () => {
			try {
				const threads = await client.getThreads();
				setChatState(prev => ({...prev, threads, loading: false}));

				// If an initial search query was provided, jump straight into search
				if (initialSearchQuery) {
					const results = threads.filter(t =>
						t.name.toLowerCase().includes(initialSearchQuery.toLowerCase()),
					);
					setSearchResults(results);
					setIsSearching(true);
				}
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg);
				setChatState(prev => ({...prev, loading: false}));
			}
		};

		void loadThreads();
	}, [client, initialSearchQuery]);

	// ── Realtime Events ──────────────────────────────────────────────────

	useEffect(() => {
		const handleStatus = (status: ConnectionStatus) => setConnectionStatus(status);

		// Incoming message (from others)
		const handleMessage = (message: Message) => {
			// If this message belongs to the currently open thread, append it
			setChatState(prev => {
				// Update the threads list — bump the matching thread's lastMessage
				const updatedThreads = prev.threads.map(t =>
					t.id === message.threadId
						? {...t, lastMessage: message, timestamp: message.timestamp}
						: t,
				);

				if (
					prev.currentThread &&
					message.threadId === prev.currentThread.id
				) {
					return {
						...prev,
						threads: updatedThreads,
						messages: [...prev.messages, message],
					};
				}

				return {...prev, threads: updatedThreads};
			});
		};

		// Our outgoing message confirmed
		const handleMessageCreate = (message: Message) => {
			setChatState(prev => {
				const updatedThreads = prev.threads.map(t =>
					t.id === message.threadId
						? {...t, lastMessage: message, timestamp: message.timestamp}
						: t,
				);

				if (
					prev.currentThread &&
					message.threadId === prev.currentThread.id
				) {
					return {
						...prev,
						threads: updatedThreads,
						// Avoid duplicate if already added optimistically
						messages: prev.messages.some(m => m.id === message.id)
							? prev.messages
							: [...prev.messages, message],
					};
				}

				return {...prev, threads: updatedThreads};
			});
		};

		client.on('status', handleStatus);
		client.on('message', handleMessage);
		client.on('message_create', handleMessageCreate);

		return () => {
			client.off('status', handleStatus);
			client.off('message', handleMessage);
			client.off('message_create', handleMessageCreate);
		};
	}, [client]);

	// ── Thread Selection ─────────────────────────────────────────────────

	const handleThreadSelect = useCallback(
		async (thread: Thread) => {
			setCurrentView('chat');
			setChatState(prev => ({
				...prev,
				currentThread: thread,
				messages: [],
				loading: true,
			}));
			setIsSearching(false);
			setSearchQuery('');
			setSearchResults([]);

			try {
				const messages = await client.getMessages(thread.id, 50);
				setChatState(prev => ({...prev, messages, loading: false}));
				// Mark chat as read
				await client.markAsRead(thread.id);
			} catch (err) {
				setError(err instanceof Error ? err.message : 'Failed to load messages');
				setChatState(prev => ({...prev, loading: false}));
			}
		},
		[client],
	);

	// ── Send Message ─────────────────────────────────────────────────────

	const handleSend = useCallback(
		async (text: string) => {
			const {currentThread} = chatState;
			if (!currentThread) return;

			try {
				await client.sendMessage(currentThread.id, text);
				setSystemMessage('✓ Sent');
			} catch (err) {
				setSystemMessage(
					`✗ Failed: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		},
		[client, chatState],
	);

	// ── Search ────────────────────────────────────────────────────────────

	const handleSearchChange = useCallback(
		(query: string) => {
			setSearchQuery(query);
			if (!query.trim()) {
				setSearchResults([]);
				return;
			}

			const results = chatState.threads.filter(t =>
				t.name.toLowerCase().includes(query.toLowerCase()),
			);
			setSearchResults(results);
		},
		[chatState.threads],
	);

	// ── Keyboard Shortcuts ────────────────────────────────────────────────

	useInput((input, key) => {
		// Global quit
		if (input === 'q' && !isSearching && currentView === 'threads') {
			exit();
			return;
		}

		// ESC: go back from chat → threads
		if (key.escape) {
			if (isSearching) {
				setIsSearching(false);
				setSearchQuery('');
				setSearchResults([]);
				return;
			}

			if (currentView === 'chat') {
				setCurrentView('threads');
				setChatState(prev => ({...prev, currentThread: undefined, messages: []}));
			}

			return;
		}

		// '/' to open search in thread list
		if (input === '/' && currentView === 'threads' && !isSearching) {
			setIsSearching(true);
		}
	});

	// ── Layout ────────────────────────────────────────────────────────────

	const displayedThreads = isSearching
		? searchResults
		: chatState.threads;

	const threadPanelWidth = Math.floor(width * 0.3);

	return (
		<FullScreen>
			<Box flexDirection="column" height="100%" width="100%">
				{/* Status Bar */}
				<StatusBar
					isLoading={chatState.loading}
					error={error}
					currentView={currentView}
					currentThread={chatState.currentThread}
					connectionStatus={connectionStatus}
					myName={client.myName}
				/>

				{/* System Messages */}
				{systemMessage && (
					<Box paddingX={1}>
						<Text color="yellow">{systemMessage}</Text>
					</Box>
				)}

				{/* Main Content */}
				<Box flexGrow={1} flexDirection="row" overflow="hidden">

					{/* Left: Thread Panel */}
					<Box
						flexDirection="column"
						width={threadPanelWidth}
						borderStyle="single"
						borderColor="gray"
						overflow="hidden"
					>
						{/* Panel header */}
						<Box paddingX={1} borderStyle="single" borderColor="gray">
							<Text bold color="green">Chats</Text>
							{isSearching && (
								<Text dimColor> ({searchResults.length} results)</Text>
							)}
						</Box>

						{/* Error banner — shows actual message */}
						{error && (
							<Box paddingX={1} borderStyle="single" borderColor="red">
								<Text color="red" wrap="wrap">⚠ {error}</Text>
							</Box>
						)}

						{/* Search Input */}
						{isSearching && (
							<Box paddingX={1}>
								<SearchInput
									value={searchQuery}
									onChange={handleSearchChange}
									onSubmit={() => {
										if (searchResults[0]) {
											void handleThreadSelect(searchResults[0]);
										}
									}}
									placeholder="Search chats…"
								/>
							</Box>
						)}

						{chatState.loading && currentView === 'threads' ? (
							<Box flexGrow={1} justifyContent="center" alignItems="center">
								<Text color="yellow">Loading chats…</Text>
							</Box>
						) : (
							<ThreadList
								threads={displayedThreads}
								onSelect={thread => void handleThreadSelect(thread)}
							/>
						)}

						{/* Hint */}
						<Box paddingX={1} borderStyle="single" borderColor="gray">
							<Text dimColor>
								{isSearching
									? '[ESC] cancel  [↑↓/jk] navigate  [Enter] open'
									: '[↑↓/jk] nav  [Enter] open  [/] search  [q] quit'}
							</Text>
						</Box>
					</Box>

					{/* Right: Chat Panel */}
					<Box
						flexDirection="column"
						flexGrow={1}
						overflow="hidden"
					>
						{currentView === 'chat' && chatState.currentThread ? (
							<>
								{/* Chat header */}
								<Box
									paddingX={1}
									borderStyle="single"
									borderColor="green"
								>
									<Text bold color="green">
										{chatState.currentThread.isGroup ? '👥 ' : ''}
										{chatState.currentThread.name}
									</Text>
									{chatState.currentThread.isGroup && (
										<Text dimColor>
											{'  '}
											{chatState.currentThread.participants?.length ?? 0} members
										</Text>
									)}
								</Box>

								{/* Messages */}
								<Box flexGrow={1} overflow="hidden" flexDirection="column">
									{chatState.loading ? (
										<Box
											flexGrow={1}
											justifyContent="center"
											alignItems="center"
										>
											<Text color="yellow">Loading messages…</Text>
										</Box>
									) : (
										<MessageList
											messages={chatState.messages}
											currentThread={chatState.currentThread}
										/>
									)}
								</Box>

								{/* Input */}
								<InputBox
									onSend={text => void handleSend(text)}
									isDisabled={chatState.loading}
								/>

								{/* Hint */}
								<Box paddingX={1}>
									<Text dimColor>
										[Enter] send  [ESC] back to chats  [q] quit
									</Text>
								</Box>
							</>
						) : (
							<Box
								flexGrow={1}
								justifyContent="center"
								alignItems="center"
								flexDirection="column"
								gap={1}
							>
								<Text bold color="gray">
									Select a chat to start messaging
								</Text>
								<Text dimColor>
									Navigate with j/k or arrow keys, press Enter to open
								</Text>
							</Box>
						)}
					</Box>
				</Box>
			</Box>
		</FullScreen>
	);
}
