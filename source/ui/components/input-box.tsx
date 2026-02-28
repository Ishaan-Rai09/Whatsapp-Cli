import React, {useState} from 'react';
import {Box, useInput} from 'ink';
import TextInput from 'ink-text-input';

type InputBoxProperties = {
	readonly onSend: (message: string) => void;
	readonly isDisabled?: boolean;
	readonly placeholder?: string;
};

export default function InputBox({
	onSend,
	isDisabled = false,
	placeholder = 'Type a message…',
}: InputBoxProperties) {
	const [message, setMessage] = useState('');

	const handleSubmit = (value: string) => {
		if (value.trim()) {
			onSend(value.trim());
			setMessage('');
		}
	};

	// Allow Escape to clear the input
	useInput((_, key) => {
		if (key.escape) {
			setMessage('');
		}
	});

	return (
		<Box
			borderStyle="round"
			borderColor={isDisabled ? 'gray' : 'green'}
			paddingX={1}
			flexShrink={0}
		>
			<TextInput
				value={message}
				onChange={setMessage}
				onSubmit={handleSubmit}
				placeholder={isDisabled ? 'Connecting…' : placeholder}
				focus={!isDisabled}
			/>
		</Box>
	);
}
