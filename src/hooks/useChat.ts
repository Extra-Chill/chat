import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types/message.ts';
import type { ChatSession } from '../types/session.ts';
import type { ChatAvailability } from '../types/session.ts';
import type { FetchFn, ChatApiConfig } from '../api.ts';
import {
	sendMessage as apiSendMessage,
	continueResponse as apiContinueResponse,
	listSessions as apiListSessions,
	loadSession as apiLoadSession,
	deleteSession as apiDeleteSession,
} from '../api.ts';

/**
 * Configuration for the useChat hook.
 */
export interface UseChatOptions {
	/**
	 * Base path for the chat REST endpoints.
	 * e.g. '/datamachine/v1/chat'
	 */
	basePath: string;
	/**
	 * Fetch function for API calls. Must accept { path, method?, data? }
	 * and return parsed JSON. @wordpress/api-fetch works directly.
	 */
	fetchFn: FetchFn;
	/**
	 * Agent ID to scope the chat to.
	 */
	agentId?: number;
	/**
	 * Initial messages to hydrate state with (e.g. server-rendered).
	 */
	initialMessages?: ChatMessage[];
	/**
	 * Initial session ID (e.g. from server-rendered state).
	 */
	initialSessionId?: string;
	/**
	 * Maximum number of continuation turns before stopping.
	 * Defaults to 20.
	 */
	maxContinueTurns?: number;
	/**
	 * Called when a new message is added to the conversation.
	 */
	onMessage?: (message: ChatMessage) => void;
	/**
	 * Called when an error occurs.
	 */
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
	/** List of sessions. */
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
	/** Clear the current session's messages locally. */
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
 * Manages messages, sessions, continuation loops, and availability
 * by calling the standard chat REST endpoints directly.
 *
 * @example
 * ```tsx
 * import apiFetch from '@wordpress/api-fetch';
 *
 * const chat = useChat({
 *   basePath: '/datamachine/v1/chat',
 *   fetchFn: apiFetch,
 *   agentId: 5,
 * });
 *
 * return (
 *   <>
 *     <ChatMessages messages={chat.messages} />
 *     <TypingIndicator visible={chat.isLoading} />
 *     <ChatInput onSend={chat.sendMessage} disabled={chat.isLoading} />
 *   </>
 * );
 * ```
 */
export function useChat({
	basePath,
	fetchFn,
	agentId,
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

	// Build API config from props
	const configRef = useRef<ChatApiConfig>({ basePath, fetchFn, agentId });
	configRef.current = { basePath, fetchFn, agentId };

	const sessionIdRef = useRef(sessionId);
	sessionIdRef.current = sessionId;

	// Load sessions on mount
	useEffect(() => {
		const loadSessions = async () => {
			setSessionsLoading(true);
			try {
				const list = await apiListSessions(configRef.current);
				setSessions(list);
			} catch (err) {
				// Sessions not available — degrade gracefully
				onError?.(err instanceof Error ? err : new Error(String(err)));
			} finally {
				setSessionsLoading(false);
			}
		};

		loadSessions();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const sendMessage = useCallback(async (content: string) => {
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
			const result = await apiSendMessage(
				configRef.current,
				content,
				sessionIdRef.current ?? undefined,
			);

			// Update session ID (may be newly created)
			setSessionId(result.sessionId);
			sessionIdRef.current = result.sessionId;

			// Replace all messages with the full normalized conversation
			setMessages(result.messages);

			// Handle multi-turn continuation
			if (!result.completed && !result.maxTurnsReached) {
				let completed = false;
				let turns = 0;

				while (!completed && turns < maxContinueTurns) {
					turns++;
					setTurnCount(turns);

					const continuation = await apiContinueResponse(
						configRef.current,
						result.sessionId,
					);

					setMessages((prev) => [...prev, ...continuation.messages]);
					for (const msg of continuation.messages) {
						onMessage?.(msg);
					}

					completed = continuation.completed || continuation.maxTurnsReached;
				}
			}

			// Refresh sessions list after a message
			apiListSessions(configRef.current)
				.then(setSessions)
				.catch(() => { /* ignore */ });

		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			onError?.(error);

			// Check if it's an auth error
			if (error.message.includes('403') || error.message.includes('rest_forbidden')) {
				setAvailability({ status: 'login-required' });
			}

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
		setSessionId(newSessionId);
		sessionIdRef.current = newSessionId;
		setIsLoading(true);

		try {
			const loaded = await apiLoadSession(configRef.current, newSessionId);
			setMessages(loaded);
		} catch (err) {
			onError?.(err instanceof Error ? err : new Error(String(err)));
			setMessages([]);
		} finally {
			setIsLoading(false);
		}
	}, [onError]);

	const newSession = useCallback(() => {
		setSessionId(null);
		sessionIdRef.current = null;
		setMessages([]);
	}, []);

	const deleteSessionHandler = useCallback(async (targetSessionId: string) => {
		try {
			await apiDeleteSession(configRef.current, targetSessionId);
			setSessions((prev) => prev.filter((s) => s.id !== targetSessionId));

			if (sessionIdRef.current === targetSessionId) {
				setSessionId(null);
				sessionIdRef.current = null;
				setMessages([]);
			}
		} catch (err) {
			onError?.(err instanceof Error ? err : new Error(String(err)));
		}
	}, [onError]);

	const clearSession = useCallback(() => {
		setMessages([]);
	}, []);

	const refreshSessions = useCallback(async () => {
		setSessionsLoading(true);
		try {
			const list = await apiListSessions(configRef.current);
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
		deleteSession: deleteSessionHandler,
		clearSession,
		refreshSessions,
	};
}
