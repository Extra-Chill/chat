/**
 * REST API client for the chat package.
 *
 * Speaks the standard chat REST contract natively. Any backend that
 * implements the same endpoint shapes works out of the box.
 *
 * The `fetchFn` parameter allows consumers to plug in their own
 * fetch implementation.
 */

import type { ChatMessage } from './types/message.ts';
import type { ChatSession } from './types/session.ts';
import type {
	SendRequest,
	SendResponse,
	ContinueResponse,
	ListSessionsResponse,
	GetSessionResponse,
	DeleteSessionResponse,
} from './types/api.ts';
import { normalizeConversation, normalizeMessage, normalizeSession } from './normalizer.ts';

/**
 * A fetch-like function. Accepts path + options, returns parsed JSON.
 *
 * Consumers can wrap native fetch:
 *   (opts) => fetch(baseUrl + opts.path, { method: opts.method, body: JSON.stringify(opts.data) }).then(r => r.json())
 */
export interface FetchOptions {
	path: string;
	method?: string;
	/** JSON body (mutually exclusive with formData). */
	data?: unknown;
	/** FormData body for file uploads (mutually exclusive with data). */
	formData?: FormData;
	/** Additional HTTP headers. */
	headers?: Record<string, string>;
}

export type FetchFn = (options: FetchOptions) => Promise<unknown>;

export interface ChatApiConfig {
	/** Base path for the chat endpoints. */
	basePath: string;
	/** The fetch function to use for requests. */
	fetchFn: FetchFn;
	/** Optional adapter-level assistant identifier to scope sessions to. */
	agentId?: number;
}

export interface SendResult {
	sessionId: string;
	/** Opaque ID for the accepted chat run, when supplied by the backend. */
	runId: string | null;
	messages: ChatMessage[];
	metadata: Record<string, unknown>;
	completed: boolean;
	turnNumber: number;
	maxTurnsReached: boolean;
}

export interface ContinueResult {
	/** Opaque ID for the active chat run, when supplied by the backend. */
	runId: string | null;
	messages: ChatMessage[];
	metadata: Record<string, unknown>;
	completed: boolean;
	turnNumber: number;
	maxTurnsReached: boolean;
}

export interface SendMessageInput {
	content: string;
	sessionId?: string;
	attachments?: SendAttachment[];
	metadata?: Record<string, unknown>;
	clientContext?: Record<string, unknown>;
}

export interface ListSessionsInput {
	limit?: number;
	context?: string;
}

export interface CancelRunInput {
	runId: string;
	sessionId: string;
}

export interface QueueMessageInput extends SendMessageInput {
	sessionId: string;
	/** Active run this message should follow, when known. */
	runId?: string;
	files?: File[];
}

export interface QueueMessageResult {
	/** Opaque ID assigned to the queued user message. */
	queuedMessageId?: string;
	/** Opaque ID for the queued or active run, when supplied by the adapter. */
	runId?: string;
	/** Zero-based or one-based queue position, as reported by the adapter. */
	position?: number;
	metadata?: Record<string, unknown>;
}

export interface ChatRunCapabilities {
	/** Whether the current backend adapter can cancel an active run. */
	cancel?: boolean;
	/** Whether the current backend adapter can queue follow-up messages. */
	queue?: boolean;
}

export interface ChatAdapter {
	runCapabilities?: ChatRunCapabilities;
	sendMessage(input: SendMessageInput): Promise<SendResult>;
	continueResponse(sessionId: string): Promise<ContinueResult>;
	listSessions(input?: ListSessionsInput): Promise<ChatSession[]>;
	loadSession(sessionId: string): Promise<ChatMessage[]>;
	deleteSession(sessionId: string): Promise<void>;
	markSessionRead?(sessionId: string): Promise<void>;
	uploadFile?(file: File): Promise<{ url: string; media_id?: number }>;
	cancelRun?(input: CancelRunInput): Promise<void> | void;
	queueMessage?(input: QueueMessageInput): Promise<QueueMessageResult | void> | QueueMessageResult | void;
}

/**
 * Attachment metadata to send with a message.
 */
export interface SendAttachment {
	url?: string;
	media_id?: number;
	mime_type?: string;
	filename?: string;
}

/**
 * Upload function provided by the consumer to handle file uploads.
 *
 * Called for each file the user attaches before the chat message is sent.
 * Must upload the file to the consumer's storage and return a URL and/or media ID
 * that the backend can resolve.
 *
 * @example
 * ```tsx
 * const mediaUploadFn: MediaUploadFn = async (file) => {
 *   const media = await uploadMedia(file);
 *   return { url: media.url, media_id: media.id };
 * };
 * ```
 */
export type MediaUploadFn = (file: File) => Promise<{ url: string; media_id?: number }>;

export function createSendMessageRequest(
	config: ChatApiConfig,
	input: SendMessageInput,
): SendRequest {
	const body: SendRequest = { message: input.content };
	if (input.sessionId) body.session_id = input.sessionId;
	if (config.agentId) body.agent_id = config.agentId;
	if (input.attachments?.length) body.attachments = input.attachments;
	if (input.metadata) body.metadata = input.metadata;
	if (input.clientContext) body.clientContext = input.clientContext;
	return body;
}

export function createRestChatAdapter(config: ChatApiConfig): ChatAdapter {
	return {
		sendMessage: (input) => sendMessage(
			config,
			input.content,
			input.sessionId,
			input.attachments,
			input.metadata,
			input.clientContext,
		),
		continueResponse: (sessionId) => continueResponse(config, sessionId),
		listSessions: (input) => listSessions(config, input?.limit, input?.context),
		loadSession: (sessionId) => loadSession(config, sessionId),
		deleteSession: (sessionId) => deleteSession(config, sessionId),
		markSessionRead: (sessionId) => markSessionRead(config, sessionId),
	};
}

/**
 * Send a user message (create or continue a session).
 *
 * When attachments are provided, they are included in the JSON body
 * as structured metadata (not as file uploads — files should already
 * be accessible by URL).
 *
 * @param metadata - Arbitrary key-value pairs forwarded to the backend
 *   alongside the message (e.g. `{ selected_pipeline_id: 42 }` or
 *   `{ post_id: 100, context: 'editor' }`). The backend can use these
 *   to scope the AI's behavior. Not persisted as message content.
 */
export async function sendMessage(
	config: ChatApiConfig,
	content: string,
	sessionId?: string,
	attachments?: SendAttachment[],
	metadata?: Record<string, unknown>,
	clientContext?: Record<string, unknown>,
): Promise<SendResult> {
	const body = createSendMessageRequest(config, {
		content,
		sessionId,
		attachments,
		metadata,
		clientContext,
	});

	// Generate a unique request ID for idempotent request handling.
	const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID()
		: `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

	const raw = await config.fetchFn({
		path: config.basePath,
		method: 'POST',
		data: body,
		headers: { 'X-Request-ID': requestId },
	}) as SendResponse;

	if (!raw.success) {
		throw new Error((raw as unknown as { message?: string }).message ?? 'Failed to send message');
	}

	return {
		sessionId: raw.data.session_id,
		runId: typeof raw.data.run_id === 'string' ? raw.data.run_id : null,
		messages: normalizeConversation(raw.data.conversation),
		metadata: raw.data.metadata ?? {},
		completed: raw.data.completed,
		turnNumber: raw.data.turn_number,
		maxTurnsReached: raw.data.max_turns_reached,
	};
}

/**
 * Continue a multi-turn response.
 */
export async function continueResponse(
	config: ChatApiConfig,
	sessionId: string,
): Promise<ContinueResult> {
	const raw = await config.fetchFn({
		path: `${config.basePath}/continue`,
		method: 'POST',
		data: { session_id: sessionId },
	}) as ContinueResponse;

	if (!raw.success) {
		throw new Error((raw as unknown as { message?: string }).message ?? 'Failed to continue');
	}

	return {
		runId: typeof raw.data.run_id === 'string' ? raw.data.run_id : null,
		messages: raw.data.new_messages.map(normalizeMessage),
		metadata: raw.data.metadata ?? {},
		completed: raw.data.completed,
		turnNumber: raw.data.turn_number,
		maxTurnsReached: raw.data.max_turns_reached,
	};
}

/**
 * List sessions for the current user.
 *
 * @param context - Optional context filter (e.g. 'chat', 'editor', 'pipeline').
 *   Only sessions created in the matching context are returned.
 */
export async function listSessions(
	config: ChatApiConfig,
	limit = 20,
	context?: string,
): Promise<ChatSession[]> {
	const params = new URLSearchParams({ limit: String(limit) });
	if (config.agentId) params.set('agent_id', String(config.agentId));
	if (context) params.set('context', context);

	const raw = await config.fetchFn({
		path: `${config.basePath}/sessions?${params.toString()}`,
	}) as ListSessionsResponse;

	if (!raw.success) {
		throw new Error('Failed to list sessions');
	}

	return raw.data.sessions.map(normalizeSession);
}

/**
 * Load a single session's conversation.
 */
export async function loadSession(
	config: ChatApiConfig,
	sessionId: string,
): Promise<ChatMessage[]> {
	const raw = await config.fetchFn({
		path: `${config.basePath}/${sessionId}`,
	}) as GetSessionResponse;

	if (!raw.success) {
		throw new Error('Failed to load session');
	}

	return normalizeConversation(raw.data.conversation);
}

/**
 * Mark a session as read, resetting its unread count.
 *
 * Calls `POST /sessions/{id}/read` to set `last_read_at` on the backend.
 */
export async function markSessionRead(
	config: ChatApiConfig,
	sessionId: string,
): Promise<void> {
	await config.fetchFn({
		path: `${config.basePath}/sessions/${sessionId}/read`,
		method: 'POST',
	});
}

/**
 * Delete a session.
 */
export async function deleteSession(
	config: ChatApiConfig,
	sessionId: string,
): Promise<void> {
	const raw = await config.fetchFn({
		path: `${config.basePath}/${sessionId}`,
		method: 'DELETE',
	}) as DeleteSessionResponse;

	if (!raw.success) {
		throw new Error('Failed to delete session');
	}
}
