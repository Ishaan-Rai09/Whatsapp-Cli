import {useEffect, useCallback, type default as React} from 'react';
import {useApp, useStdout} from 'ink';

async function write(content: string, stdout: NodeJS.WriteStream) {
	return new Promise<void>((resolve, reject) => {
		stdout.write(content, error => {
			if (error) reject(error);
			else resolve();
		});
	});
}

function AltScreen(properties: {children: React.ReactNode}) {
	const {exit} = useApp();
	const {stdout} = useStdout();

	const enterAltScreen = useCallback(async () => {
		await write('\u001B[?1049h', stdout);
	}, [stdout]);

	const leaveAltScreen = useCallback(async () => {
		await write('\u001B[?1049l', stdout);
		exit();
	}, [exit, stdout]);

	useEffect(() => {
		return () => {
			void leaveAltScreen();
		};
	}, [leaveAltScreen]);

	void enterAltScreen();
	return properties.children;
}

export default AltScreen;
