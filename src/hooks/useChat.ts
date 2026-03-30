import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ToolCall } from '../types/message.ts';
import type { ChatSession } from '../types/session.ts';
import type { ChatAvailability } from '../types/session.ts';
import type { MediaAttachment } from '../types/message.ts';
import type { FetchFn, ChatApiConfig, SendAttachment, MediaUploadFn } from '../api.ts';
import {
	sendMessage as apiSendMessage,
	continueResponse as apiContinueResponse,
	listSessions as apiListSessions,
	loadSession as apiLoadSession,
	deleteSession as apiDeleteSession,
	markSessionRead as apiMarkSessionRead,
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
	/**
	 * Called after each turn when tool calls are present in the response.
	 * Use this to react to tool executions (e.g. invalidate caches,
	 * apply diffs to the editor, update external state).
	 */
	onToolCalls?: (toolCalls: ToolCall[]) => void;
	/**
	 * Arbitrary metadata forwarded to the backend with each message.
	 * Use for context scoping (e.g. `{ selected_pipeline_id: 42 }`,
	 * `{ post_id: 100, context: 'editor' }`).
	 */
	metadata?: Record<string, unknown>;
	/**
	 * Upload function for file attachments.
	 *
	 * Called for each file the user attaches before the message is sent.
	 * Must upload the file and return a URL and/or media ID.
	 *
	 * When not provided, the attach button is hidden (via `allowAttachments`
	 * in the composed Chat component) because files cannot be processed.
	 */
	mediaUploadFn?: MediaUploadFn;
	/**
	 * Optional context filter for session listing.
	 * Only sessions created in the matching context are shown.
	 */
	sessionContext?: string;
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
	/**
	 * The session ID that initiated the current request.
	 * Use to avoid stale loading indicators when the user switches
	 * sessions while a request is in flight.
	 * Null when idle.
	 */
	processingSessionId: string | null;
	/** List of sessions. */
	sessions: ChatSession[];
	/** Whether sessions are loading. */
	sessionsLoading: boolean;
	/** Unread count for the active session. */
	unreadCount: number;
	/** Total unread count across all sessions. */
	totalUnreadCount: number;
	/** Send a user message (with optional file attachments). */
	sendMessage: (content: string, files?: File[]) => void;
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
	/** Mark the active session as read (resets unread count). */
	markAsRead: () => Promise<void>;
}

let messageIdCounter = 0;
function generateMessageId(): string {
	return `msg_${Date.now()}_${++messageIdCounter}`;
}

/**
 * Extract a readable error message from any error shape.
 *
 * Handles Error instances, @wordpress/api-fetch error objects
 * ({ code, message, data }), and plain strings.
 */
function toError(err: unknown): Error {
	if (err instanceof Error) return err;
	if (typeof err === 'string') return new Error(err);
	if (err && typeof err === 'object') {
		const obj = err as Record<string, unknown>;
		if (typeof obj.message === 'string') return new Error(obj.message);
		if (typeof obj.code === 'string') return new Error(obj.code);
		try { return new Error(JSON.stringify(err)); } catch { /* fall through */ }
	}
	return new Error('An unknown error occurred');
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
	onToolCalls,
	metadata,
	mediaUploadFn,
	sessionContext,
}: UseChatOptions): UseChatReturn {
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages ?? []);
	const [isLoading, setIsLoading] = useState(false);
	const [turnCount, setTurnCount] = useState(0);
	const [availability, setAvailability] = useState<ChatAvailability>({ status: 'ready' });
	const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
	const [processingSessionId, setProcessingSessionId] = useState<string | null>(null);
	const [sessions, setSessions] = useState<ChatSession[]>([]);
	const [sessionsLoading, setSessionsLoading] = useState(false);

	// Derive unread counts from session list.
	const totalUnreadCount = sessions.reduce((sum, s) => sum + (s.unreadCount ?? 0), 0);
	const activeSession = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
	const unreadCount = activeSession?.unreadCount ?? 0;

	// Build API config from props
	const configRef = useRef<ChatApiConfig>({ basePath, fetchFn, agentId });
	configRef.current = { basePath, fetchFn, agentId };

	const sessionIdRef = useRef(sessionId);
	sessionIdRef.current = sessionId;

	// Refs for latest callback/metadata values (avoid stale closures).
	const onToolCallsRef = useRef(onToolCalls);
	onToolCallsRef.current = onToolCalls;
	const metadataRef = useRef(metadata);
	metadataRef.current = metadata;
	const mediaUploadFnRef = useRef(mediaUploadFn);
	mediaUploadFnRef.current = mediaUploadFn;
	const sessionContextRef = useRef(sessionContext);
	sessionContextRef.current = sessionContext;
	// Guard against concurrent session creation.
	const isCreatingRef = useRef(false);

	// Load sessions on mount
	useEffect(() => {
		const loadSessions = async () => {
			setSessionsLoading(true);
			try {
				const list = await apiListSessions(
					configRef.current,
					20,
					sessionContextRef.current,
				);
				setSessions(list);
			} catch (err) {
				// Sessions not available — degrade gracefully
				onError?.(toError(err));
			} finally {
				setSessionsLoading(false);
			}
		};

		loadSessions();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	/**
	 * Collect tool calls from a list of messages and fire the onToolCalls callback.
	 */
	const fireToolCalls = useCallback((msgs: ChatMessage[]) => {
		const cb = onToolCallsRef.current;
		if (!cb) return;

		const allToolCalls: ToolCall[] = [];
		for (const msg of msgs) {
			if (msg.toolCalls?.length) {
				allToolCalls.push(...msg.toolCalls);
			}
		}
		if (allToolCalls.length > 0) {
			cb(allToolCalls);
		}
	}, []);

	const sendMessage = useCallback(async (content: string, files?: File[]) => {
		if (isLoading || isCreatingRef.current) return;

		// Build optimistic attachment previews from local files.
		let optimisticAttachments: MediaAttachment[] | undefined;
		let sendAttachments: SendAttachment[] | undefined;

		if (files?.length) {
			optimisticAttachments = files.map((file) => ({
				type: file.type.startsWith('image/') ? 'image' as const
					: file.type.startsWith('video/') ? 'video' as const
					: 'file' as const,
				url: URL.createObjectURL(file),
				filename: file.name,
				mimeType: file.type,
				size: file.size,
			}));

			// Upload files via the consumer's upload function, or fall back
			// to metadata-only attachments (which the backend will reject
			// without a url/media_id).
			const uploadFn = mediaUploadFnRef.current;
			if (uploadFn) {
				try {
					sendAttachments = await Promise.all(
						files.map(async (file) => {
							const uploaded = await uploadFn(file);
							return {
								filename: file.name,
								mime_type: file.type,
								url: uploaded.url,
								media_id: uploaded.media_id,
							};
						}),
					);
				} catch (err) {
					onError?.(toError(err));
					return;
				}
			} else {
				// No upload function — strip attachments so we don't send
				// incomplete metadata that the backend will reject.
				optimisticAttachments = undefined;
			}
		}

		// Optimistically add user message
		const userMessage: ChatMessage = {
			id: generateMessageId(),
			role: 'user',
			content,
			timestamp: new Date().toISOString(),
			attachments: optimisticAttachments,
		};

		// Guard against concurrent session creation.
		if (!sessionIdRef.current) {
			isCreatingRef.current = true;
		}

		setMessages((prev) => [...prev, userMessage]);
		onMessage?.(userMessage);
		setIsLoading(true);
		setTurnCount(0);

		// Track which session initiated the request.
		const initiatingSessionId = sessionIdRef.current;
		setProcessingSessionId(initiatingSessionId);

		try {
			const result = await apiSendMessage(
				configRef.current,
				content,
				sessionIdRef.current ?? undefined,
				sendAttachments,
				metadataRef.current,
			);

			isCreatingRef.current = false;

			// Update session ID (may be newly created)
			setSessionId(result.sessionId);
			sessionIdRef.current = result.sessionId;
			setProcessingSessionId(result.sessionId);

			// Replace all messages with the full normalized conversation
			setMessages(result.messages);

			// Fire tool call callback for the initial response.
			fireToolCalls(result.messages);

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

					// Fire tool call callback for each continuation turn.
					fireToolCalls(continuation.messages);

					completed = continuation.completed || continuation.maxTurnsReached;
				}
			}

			// Refresh sessions list after a message
			apiListSessions(configRef.current, 20, sessionContextRef.current)
				.then(setSessions)
				.catch(() => { /* ignore */ });

		} catch (err) {
			isCreatingRef.current = false;
			const error = toError(err);
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
			setProcessingSessionId(null);
		}
	}, [isLoading, maxContinueTurns, onMessage, onError, fireToolCalls]);

	const switchSession = useCallback(async (newSessionId: string) => {
		setSessionId(newSessionId);
		sessionIdRef.current = newSessionId;
		setIsLoading(true);

		try {
			const loaded = await apiLoadSession(configRef.current, newSessionId);
			setMessages(loaded);
		} catch (err) {
			onError?.(toError(err));
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
			onError?.(toError(err));
		}
	}, [onError]);

	const clearSession = useCallback(() => {
		setMessages([]);
	}, []);

	const markAsRead = useCallback(async () => {
		const currentSessionId = sessionIdRef.current;
		if (!currentSessionId) return;

		// Optimistically zero out unread count for the active session.
		setSessions((prev) =>
			prev.map((s) =>
				s.id === currentSessionId ? { ...s, unreadCount: 0 } : s,
			),
		);

		try {
			await apiMarkSessionRead(configRef.current, currentSessionId);
		} catch {
			// Silently fail — next session list refresh will correct the count.
		}
	}, []);

	const refreshSessions = useCallback(async () => {
		setSessionsLoading(true);
		try {
			const list = await apiListSessions(
				configRef.current,
				20,
				sessionContextRef.current,
			);
			setSessions(list);
		} catch (err) {
			onError?.(toError(err));
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
		processingSessionId,
		sessions,
		sessionsLoading,
		unreadCount,
		totalUnreadCount,
		sendMessage,
		switchSession,
		newSession,
		deleteSession: deleteSessionHandler,
		clearSession,
		refreshSessions,
		markAsRead,
	};
}
