import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Default pool of loading messages.
 *
 * Music-forward, Extra-Chill-flavored, but generic enough for any consumer.
 * Consumers can extend or replace this list entirely.
 */
export const DEFAULT_LOADING_MESSAGES: readonly string[] = [
	'Thinking…',
	'Working on it…',
	'Tuning in…',
	'Spinning the record…',
	'Vibing on it…',
	'Getting in the groove…',
	'Mixing it together…',
	'Letting it marinate…',
	'Finding the right note…',
	'Warming up…',
	'Loading the setlist…',
	'Checking the tracklist…',
	'Cueing up…',
	'On it…',
	'One sec…',
	'Almost there…',
	'Cooking something up…',
];

/**
 * Configuration for loading message behavior.
 */
export interface LoadingMessagesConfig {
	/**
	 * How to handle the provided messages relative to the defaults.
	 *
	 * - `'default'` — Use only the built-in pool (ignore `messages`).
	 * - `'extend'`  — Merge `messages` into the built-in pool.
	 * - `'override'` — Replace the built-in pool entirely with `messages`.
	 *
	 * @default 'default'
	 */
	mode?: 'default' | 'extend' | 'override';
	/**
	 * Custom messages to add or replace the defaults with.
	 * Ignored when `mode` is `'default'`.
	 */
	messages?: string[];
	/**
	 * How often (ms) to cycle to the next message.
	 * @default 3000
	 */
	interval?: number;
}

export interface UseLoadingMessagesReturn {
	/** The current loading message to display. Changes on each cycle. */
	message: string;
}

/**
 * Shuffle an array using Fisher-Yates.
 * Returns a new array — does not mutate the input.
 */
function shuffle<T>(array: readonly T[]): T[] {
	const result = [...array];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/**
 * Cycles through a pool of loading messages while `active` is true.
 *
 * On activation, the pool is shuffled and the first message is shown
 * immediately. Every `interval` ms, the next message in the shuffled
 * order is displayed. When the pool is exhausted, it re-shuffles and
 * continues from the top.
 *
 * ## Usage modes
 *
 * ```tsx
 * // 1. Defaults — built-in pool
 * const { message } = useLoadingMessages(chat.isLoading);
 *
 * // 2. Extend — add your own on top of defaults
 * const { message } = useLoadingMessages(chat.isLoading, {
 *   mode: 'extend',
 *   messages: ['Summoning the muse…', 'Consulting the oracle…'],
 * });
 *
 * // 3. Override — your pool only
 * const { message } = useLoadingMessages(chat.isLoading, {
 *   mode: 'override',
 *   messages: ['Searching…', 'Analyzing…', 'Compiling…'],
 * });
 * ```
 */
export function useLoadingMessages(
	active: boolean,
	config?: LoadingMessagesConfig,
): UseLoadingMessagesReturn {
	const mode = config?.mode ?? 'default';
	const customMessages = config?.messages;
	const interval = config?.interval ?? 3000;

	// Build the resolved pool once per config change.
	const poolRef = useRef<readonly string[]>(DEFAULT_LOADING_MESSAGES);

	// Track the shuffled queue and current index.
	const queueRef = useRef<string[]>([]);
	const indexRef = useRef(0);

	const [message, setMessage] = useState('');

	// Resolve pool when config changes.
	useEffect(() => {
		if (mode === 'override' && customMessages?.length) {
			poolRef.current = customMessages;
		} else if (mode === 'extend' && customMessages?.length) {
			// Deduplicate: defaults first, then custom entries not already present.
			const set = new Set(DEFAULT_LOADING_MESSAGES);
			const extras = customMessages.filter((m) => !set.has(m));
			poolRef.current = [...DEFAULT_LOADING_MESSAGES, ...extras];
		} else {
			poolRef.current = DEFAULT_LOADING_MESSAGES;
		}
	}, [mode, customMessages]);

	/**
	 * Get the next message from the shuffled queue.
	 * Re-shuffles when the queue is exhausted.
	 */
	const next = useCallback((): string => {
		if (queueRef.current.length === 0 || indexRef.current >= queueRef.current.length) {
			queueRef.current = shuffle(poolRef.current);
			indexRef.current = 0;
		}
		const msg = queueRef.current[indexRef.current];
		indexRef.current++;
		return msg;
	}, []);

	// When active flips on, show the first message immediately and start cycling.
	// When active flips off, stop the timer.
	useEffect(() => {
		if (!active) return;

		// Show first message immediately.
		setMessage(next());

		const timer = setInterval(() => {
			setMessage(next());
		}, interval);

		return () => clearInterval(timer);
	}, [active, interval, next]);

	return { message };
}
