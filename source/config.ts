import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import yaml from 'js-yaml';

// ─── Config Shape ──────────────────────────────────────────────────────────

type ChatConfig = {
	layout: 'compact' | 'normal';
};

type AdvancedConfig = {
	debugMode: boolean;
	dataDir: string;
	authDir: string;
	logsDir: string;
	puppeteerExecutablePath?: string;
};

type Config = {
	chat: ChatConfig;
	advanced: AdvancedConfig;
};

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.whatsapp-cli');

const DEFAULT_CONFIG: Config = {
	chat: {
		layout: 'compact',
	},
	advanced: {
		debugMode: false,
		dataDir: DEFAULT_DATA_DIR,
		authDir: path.join(DEFAULT_DATA_DIR, 'auth'),
		logsDir: path.join(DEFAULT_DATA_DIR, 'logs'),
	},
};

// ─── ConfigManager (singleton) ─────────────────────────────────────────────

export class ConfigManager {
	private static instance: ConfigManager | undefined;
	private config: Config = {...DEFAULT_CONFIG};
	private configPath: string;
	private initialized = false;

	private constructor() {
		this.configPath = path.join(DEFAULT_DATA_DIR, 'config.yml');
	}

	public static getInstance(): ConfigManager {
		if (!ConfigManager.instance) {
			ConfigManager.instance = new ConfigManager();
		}

		return ConfigManager.instance;
	}

	public async initialize(): Promise<void> {
		if (this.initialized) return;

		// Ensure directories exist
		await fs.mkdir(DEFAULT_DATA_DIR, {recursive: true});

		// Load config file if it exists
		try {
			const raw = await fs.readFile(this.configPath, 'utf8');
			const parsed = yaml.load(raw) as Partial<Config>;
			this.config = this.deepMerge(DEFAULT_CONFIG, parsed ?? {});
		} catch {
			// Config file doesn't exist yet – use defaults
		}

		// Ensure sub-directories
		await fs.mkdir(this.config.advanced.authDir, {recursive: true});
		await fs.mkdir(this.config.advanced.logsDir, {recursive: true});

		this.initialized = true;
	}

	public get<K extends keyof Config>(key: K): Config[K];
	public get(key: string): unknown;
	public get(key: string): unknown {
		// Support dot-notation like 'advanced.authDir'
		return key.split('.').reduce<unknown>((obj, k) => {
			if (obj && typeof obj === 'object') {
				return (obj as Record<string, unknown>)[k];
			}

			return undefined;
		}, this.config);
	}

	public async set(key: string, value: unknown): Promise<void> {
		const keys = key.split('.');
		let obj: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
		for (let i = 0; i < keys.length - 1; i++) {
			const k = keys[i]!;
			if (!obj[k] || typeof obj[k] !== 'object') {
				obj[k] = {};
			}

			obj = obj[k] as Record<string, unknown>;
		}

		obj[keys.at(-1)!] = value;

		// Persist
		await fs.writeFile(this.configPath, yaml.dump(this.config), 'utf8');
	}

	/** Check whether a local-auth session folder exists */
	public sessionExists(): boolean {
		const authDir = this.config.advanced.authDir;
		// whatsapp-web.js LocalAuth stores data in <dataPath>/session-<clientId>/
		const sessionDir = path.join(authDir, 'session-default');
		try {
			fsSync.accessSync(sessionDir);
			return true;
		} catch {
			return false;
		}
	}

	/** Delete the auth session folder */
	public async deleteSession(): Promise<void> {
		const sessionDir = path.join(this.config.advanced.authDir, 'session-default');
		try {
			await fs.rm(sessionDir, {recursive: true, force: true});
		} catch {}
	}

	// ── helpers ────────────────────────────────────────────────────────────

	private deepMerge<T extends object>(target: T, source: Partial<T>): T {
		const result = {...target};
		for (const key of Object.keys(source) as Array<keyof T>) {
			const sourceValue = source[key];
			const targetValue = target[key];
			if (
				sourceValue &&
				typeof sourceValue === 'object' &&
				!Array.isArray(sourceValue) &&
				targetValue &&
				typeof targetValue === 'object'
			) {
				(result[key] as object) = this.deepMerge(
					targetValue as object,
					sourceValue as object,
				);
			} else if (sourceValue !== undefined) {
				result[key] = sourceValue as T[keyof T];
			}
		}

		return result;
	}
}
