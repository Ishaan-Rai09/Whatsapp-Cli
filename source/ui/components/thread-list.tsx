import React, {useState, useEffect, useRef} from 'react';
import {Box, Text, useInput, measureElement, type DOMElement} from 'ink';
import type {Thread} from '../../types/whatsapp.js';
import ThreadItem from './thread-item.js';

type ThreadListProperties = {
	readonly threads: Thread[];
	readonly onSelect: (thread: Thread) => void;
	readonly onScrollToBottom?: () => void;
};

export default function ThreadList({
	threads,
	onSelect,
	onScrollToBottom,
}: ThreadListProperties) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [scrollOffset, setScrollOffset] = useState(0);
	const [viewportSize, setViewportSize] = useState(10);

	// eslint-disable-next-line @typescript-eslint/no-restricted-types
	const containerRef = useRef<DOMElement | null>(null);
	const itemHeight = 4; // each ThreadItem is ~4 rows tall

	useEffect(() => {
		if (containerRef.current) {
			const containerHeight = measureElement(containerRef.current).height;
			const newViewport = Math.max(1, Math.floor(containerHeight / itemHeight));
			setViewportSize(newViewport);
		}
	}, [threads]);

	useInput((input, key) => {
		if (threads.length === 0) return;

		if (input === 'j' || key.downArrow) {
			const newIndex = Math.min(selectedIndex + 1, threads.length - 1);
			setSelectedIndex(newIndex);

			if (newIndex >= scrollOffset + viewportSize) {
				setScrollOffset(p => p + 1);
			}

			if (newIndex === threads.length - 1) {
				onScrollToBottom?.();
			}
		} else if (input === 'k' || key.upArrow) {
			const newIndex = Math.max(selectedIndex - 1, 0);
			setSelectedIndex(newIndex);
			if (newIndex < scrollOffset) {
				setScrollOffset(p => p - 1);
			}
		} else if (key.return && threads[selectedIndex]) {
			onSelect(threads[selectedIndex]);
		}
	});

	if (threads.length === 0) {
		return (
			<Box flexGrow={1} justifyContent="center" alignItems="center">
				<Text dimColor>No chats found</Text>
			</Box>
		);
	}

	const visibleThreads = threads.slice(scrollOffset, scrollOffset + viewportSize);

	return (
		<Box ref={containerRef} flexDirection="column" flexGrow={1} overflowY="hidden">
			{visibleThreads.map((thread, index) => {
				const absoluteIndex = scrollOffset + index;
				const isLast = index === visibleThreads.length - 1;
				return (
					<Box
						key={thread.id}
						flexDirection="column"
						marginBottom={isLast ? 0 : 0}
						flexShrink={0}
					>
						<ThreadItem
							thread={thread}
							isSelected={absoluteIndex === selectedIndex}
						/>
					</Box>
				);
			})}
		</Box>
	);
}
