import {useState, useEffect} from 'react';

type ScreenSize = {
	width: number;
	height: number;
};

export function useScreenSize(): ScreenSize {
	const [size, setSize] = useState<ScreenSize>({
		width: process.stdout.columns ?? 80,
		height: process.stdout.rows ?? 24,
	});

	useEffect(() => {
		const handleResize = () => {
			setSize({
				width: process.stdout.columns ?? 80,
				height: process.stdout.rows ?? 24,
			});
		};

		process.stdout.on('resize', handleResize);
		return () => {
			process.stdout.off('resize', handleResize);
		};
	}, []);

	return size;
}
