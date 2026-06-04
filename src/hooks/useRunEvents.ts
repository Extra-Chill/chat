import { useCallback, useEffect, useRef, useState } from 'react';
import type { CancelRunInput, ChatRunAdapter, ChatRunEvent } from '../run-control.ts';

export interface UseRunEventsOptions extends Partial<CancelRunInput> {
	adapter?: ChatRunAdapter;
	enabled?: boolean;
	intervalMs?: number;
	onEvents?: (events: ChatRunEvent[]) => void;
	onError?: (error: Error) => void;
}

export interface UseRunEventsReturn {
	events: ChatRunEvent[];
	isLoading: boolean;
	error: Error | null;
	refresh: () => Promise<void>;
}

function toError(err: unknown): Error {
	if (err instanceof Error) return err;
	if (typeof err === 'string') return new Error(err);
	return new Error('Failed to load run events');
}

export function useRunEvents({
	adapter,
	runId,
	sessionId,
	enabled = true,
	intervalMs,
	onEvents,
	onError,
}: UseRunEventsOptions): UseRunEventsReturn {
	const [events, setEvents] = useState<ChatRunEvent[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const onEventsRef = useRef(onEvents);
	const onErrorRef = useRef(onError);
	onEventsRef.current = onEvents;
	onErrorRef.current = onError;

	const refresh = useCallback(async () => {
		if (!enabled || !adapter?.listEvents || !runId || !sessionId) return;

		setIsLoading(true);
		try {
			const nextEvents = await adapter.listEvents({ runId, sessionId });
			setEvents(nextEvents);
			setError(null);
			onEventsRef.current?.(nextEvents);
		} catch (err) {
			const nextError = toError(err);
			setError(nextError);
			onErrorRef.current?.(nextError);
		} finally {
			setIsLoading(false);
		}
	}, [adapter, enabled, runId, sessionId]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	useEffect(() => {
		if (!intervalMs || intervalMs <= 0) return;
		const timer = window.setInterval(() => {
			refresh();
		}, intervalMs);
		return () => window.clearInterval(timer);
	}, [intervalMs, refresh]);

	return { events, isLoading, error, refresh };
}
