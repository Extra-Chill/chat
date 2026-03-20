import { useState, useCallback, useRef, useEffect } from 'react';
import type {
	ChatAdapter,
	ChatMessage,
	ChatSession,
	ChatAvailability,
} from '../types/index.ts';

/**
 * Configuration for the useChat hook.
 */
export interface UseChatOptions {
	/** The adapter that handles backend communication. */
	adapter: ChatAdapter;
	/**
	 * Initial messages to hydrate state with (e.g. server-rendered).
	 * Skips calling adapter.loadInitialState() for messages if provided.
	 */
	initialMessages?: ChatMessage[];
	/** Initial session ID (e.g. from server-rendered state). */
	initialSessionId?: string;
	/**
	 * Maximum number of continuation turns before stopping.
	 * Only relevant when adapter supports continueResponse.
	 * Defaults to 20.
	 */
	maxContinueTurns?: number;
	/** Called when a new message is added to the conversation. */
	onMessage?: (message: ChatMessage) => void;
	/** Called when an error occurs. */
	onError?: (error: Error) => void;
}

/**
 * Return value of the useChat hook.
 */
export interface UseChatReturn {
	/** All messages in the current conversation. */
	messages: ChatMessage[];
	/** Whether a message is being sent/processed. */
	isLoading: boolean;
	/** Current continuation turn count (0 when not processing). */
	turnCount: number;
	/** Current availability state. */
	availability: ChatAvailability;
	/** Active session ID. */
	sessionId: string | null;
	/** List of sessions (empty if adapter doesn't support sessions). */
	sessions: ChatSession[];
	/** Whether sessions are loading. */
	sessionsLoading: boolean;
	/** Send a user message. */
	sendMessage: (content: string) => void;
	/** Switch to a different session. */
	switchSession: (sessionId: string) => void;
	/** Create a new session. */
	newSession: () => void;
	/** Delete a session. */
	deleteSession: (sessionId: string) => void;
	/** Clear the current session's messages. */
	clearSession: () => void;
	/** Refresh the session list. */
	refreshSessions: () => void;
}

let messageIdCounter = 0;
function generateMessageId(): string {
	return `msg_${Date.now()}_${++messageIdCounter}`;
}

/**
 * Core state orchestrator for the chat UI.
 *
 * Bridges the adapter contract with React state. Handles:
 * - Sending messages and appending responses
 * - Multi-turn continuation (tool calling loops)
 * - Session management (list, switch, create, delete, clear)
 * - Availability gating
 * - Optimistic user message insertion
 * - Error recovery
 *
 * @example
 * ```tsx
 * const chat = useChat({
 *   adapter: myWordPressAdapter,
 *   initialMessages: window.chatConfig?.messages,
 * });
 *
 * return (
 *   <ChatMessages messages={chat.messages} />
 *   <TypingIndicator visible={chat.isLoading} />
 *   <ChatInput onSend={chat.sendMessage} disabled={chat.isLoading} />
 * );
 * ```
 */
export function useChat({
	adapter,
	initialMessages,
	initialSessionId,
	maxContinueTurns = 20,
	onMessage,
	onError,
}: UseChatOptions): UseChatReturn {
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
	const [isLoading, setIsLoading] = useState(false);
	const [turnCount, setTurnCount] = useState(0);
	const [availability, setAvailability] = useState<ChatAvailability>({ status: 'ready' });
	const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [sessionsLoading, setSessionsLoading] = useState(false);

	// Refs to avoid stale closures
	const adapterRef = useRef(adapter);
	adapterRef.current = adapter;
	const sessionIdRef = useRef(sessionId);
	sessionIdRef.current = sessionId;

	// Load initial state on mount
	useEffect(() => {
		const load = async () => {
			const a = adapterRef.current;
			if (a.loadInitialState) {
				try {
					const state = await a.loadInitialState();
					setAvailability(state.availability);
					if (state.session) {
						setSessionId(state.session.id);
					}
					if (state.messages && !initialMessages) {
						setMessages(state.messages);
					}
				} catch (err) {
					onError?.(err instanceof Error ? err : new Error(String(err)));
				}
			}

			// Load sessions if supported
			if (a.capabilities.sessions && a.listSessions) {
				setSessionsLoading(true);
				try {
					const list = await a.listSessions();
					setSessions(list);
				} catch (err) {
					onError?.(err instanceof Error ? err : new Error(String(err)));
				} finally {
					setSessionsLoading(false);
				}
			}
		};

		load();
		// Only run on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const sendMessage = useCallback(async (content: string) => {
		const a = adapterRef.current;
		if (isLoading) return;

		// Optimistically add user message
		const userMessage: ChatMessage = {
			id: generateMessageId(),
			role: 'user',
			content,
			timestamp: new Date().toISOString(),
		};

		setMessages((prev) => [...prev, userMessage]);
		onMessage?.(userMessage);
		setIsLoading(true);
		setTurnCount(0);

		try {
			const result = await a.sendMessage({
				content,
				sessionId: sessionIdRef.current ?? undefined,
			});

			// Update session ID (may be newly created)
			setSessionId(result.sessionId);
			sessionIdRef.current = result.sessionId;

			// Append assistant messages
			setMessages((prev) => [...prev, ...result.messages]);
			for (const msg of result.messages) {
				onMessage?.(msg);
			}

			// Handle multi-turn continuation
			if (!result.completed && a.continueResponse) {
				let completed = false;
				let turns = 0;

				while (!completed && turns < maxContinueTurns) {
					turns++;
					setTurnCount(turns);

					const continuation = await a.continueResponse(result.sessionId);
					setMessages((prev) => [...prev, ...continuation.messages]);
					for (const msg of continuation.messages) {
						onMessage?.(msg);
					}

					completed = continuation.completed;
				}
			}

			// Refresh sessions list after a message
			if (a.capabilities.sessions && a.listSessions) {
				a.listSessions().then(setSessions).catch(() => { /* ignore */ });
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			onError?.(error);

			// Add error as assistant message so it's visible in the UI
			const errorMessage: ChatMessage = {
				id: generateMessageId(),
				role: 'assistant',
				content: `Sorry, something went wrong: ${error.message}`,
				timestamp: new Date().toISOString(),
			};
			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
			setTurnCount(0);
		}
	}, [isLoading, maxContinueTurns, onMessage, onError]);

	const switchSession = useCallback(async (newSessionId: string) => {
		const a = adapterRef.current;
		setSessionId(newSessionId);
		sessionIdRef.current = newSessionId;

		if (a.capabilities.history && a.loadMessages) {
			setIsLoading(true);
			try {
				const loaded = await a.loadMessages(newSessionId);
				setMessages(loaded);
			} catch (err) {
				onError?.(err instanceof Error ? err : new Error(String(err)));
				setMessages([]);
			} finally {
				setIsLoading(false);
			}
		} else {
			// Can't load history — just clear and start fresh in that session
			setMessages([]);
		}
	}, [onError]);

	const newSession = useCallback(async () => {
		const a = adapterRef.current;
		setMessages([]);

		if (a.capabilities.sessions && a.createSession) {
			try {
				const session = await a.createSession();
				setSessionId(session.id);
				sessionIdRef.current = session.id;
				setSessions((prev) => [session, ...prev]);
			} catch (err) {
				onError?.(err instanceof Error ? err : new Error(String(err)));
				// Clear session ID — next sendMessage will create one
				setSessionId(null);
				sessionIdRef.current = null;
			}
		} else {
			setSessionId(null);
			sessionIdRef.current = null;
		}
	}, [onError]);

	const deleteSession = useCallback(async (targetSessionId: string) => {
		const a = adapterRef.current;
		if (!a.capabilities.sessions || !a.deleteSession) return;

		try {
			await a.deleteSession(targetSessionId);
			setSessions((prev) => prev.filter((s) => s.id !== targetSessionId));

			// If we deleted the active session, clear it
			if (sessionIdRef.current === targetSessionId) {
				setSessionId(null);
				sessionIdRef.current = null;
				setMessages([]);
			}
		} catch (err) {
			onError?.(err instanceof Error ? err : new Error(String(err)));
		}
	}, [onError]);

	const clearSession = useCallback(async () => {
		const a = adapterRef.current;
		const sid = sessionIdRef.current;

		if (sid && a.clearSession) {
			try {
				await a.clearSession(sid);
			} catch (err) {
				onError?.(err instanceof Error ? err : new Error(String(err)));
			}
		}

		setMessages([]);
	}, [onError]);

	const refreshSessions = useCallback(async () => {
		const a = adapterRef.current;
		if (!a.capabilities.sessions || !a.listSessions) return;

		setSessionsLoading(true);
		try {
			const list = await a.listSessions();
			setSessions(list);
		} catch (err) {
			onError?.(err instanceof Error ? err : new Error(String(err)));
		} finally {
			setSessionsLoading(false);
		}
	}, [onError]);

	return {
		messages,
		isLoading,
		turnCount,
		availability,
		sessionId,
		sessions,
		sessionsLoading,
		sendMessage,
		switchSession,
		newSession,
		deleteSession,
		clearSession,
		refreshSessions,
	};
}
