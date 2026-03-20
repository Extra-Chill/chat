/**
 * The adapter contract.
 *
 * This is the main abstraction boundary. The shared chat UI calls
 * adapter methods — it never knows about REST endpoints, auth tokens,
 * WebSocket connections, or billing logic.
 *
 * Adapters declare their capabilities so the UI can conditionally
 * render features like session switching or tool display.
 */

import type { ChatMessage } from './message.ts';
import type { ChatSession, ChatInitialState } from './session.ts';

/**
 * Capability flags. The UI uses these to conditionally render features.
 */
export interface ChatCapabilities {
	/** Adapter supports multiple named sessions. */
	sessions: boolean;
	/** Adapter can load historical messages for a session. */
	history: boolean;
	/** Adapter supports real-time streaming of responses. */
	streaming: boolean;
	/** Adapter exposes tool call/result messages. */
	tools: boolean;
	/** Adapter surfaces availability states (login, provisioning, etc.). */
	availabilityStates: boolean;
}

/**
 * Input to the sendMessage method.
 */
export interface SendMessageInput {
	/** The user's message text. */
	content: string;
	/** Session to send to (undefined = create new or use default). */
	sessionId?: string;
}

/**
 * Result from a sendMessage call.
 *
 * The response can include multiple messages (e.g. tool calls + final answer).
 * If `completed` is false, the UI should call `continueResponse` to get more.
 */
export interface SendMessageResult {
	/** The session this message belongs to (may be newly created). */
	sessionId: string;
	/** New messages to append to the conversation. */
	messages: ChatMessage[];
	/** Whether the response is fully complete. */
	completed: boolean;
}

/**
 * Result from a continueResponse call.
 */
export interface ContinueResult {
	/** New messages from this turn. */
	messages: ChatMessage[];
	/** Whether the response is now fully complete. */
	completed: boolean;
}

/**
 * Callback for streaming chunks.
 */
export interface StreamChunk {
	/** Partial content delta. */
	content: string;
	/** Whether this is the final chunk. */
	done: boolean;
}

/**
 * The adapter contract.
 *
 * Only `sendMessage` and `capabilities` are required. Everything else
 * is optional — the UI degrades gracefully based on capabilities.
 *
 * @example
 * ```ts
 * const adapter: ChatAdapter = {
 *   capabilities: {
 *     sessions: false,
 *     history: false,
 *     streaming: false,
 *     tools: false,
 *     availabilityStates: false,
 *   },
 *   async sendMessage(input) {
 *     const res = await fetch('/api/chat', {
 *       method: 'POST',
 *       body: JSON.stringify({ message: input.content }),
 *     });
 *     const data = await res.json();
 *     return {
 *       sessionId: 'default',
 *       messages: [{ id: data.id, role: 'assistant', content: data.reply, timestamp: new Date().toISOString() }],
 *       completed: true,
 *     };
 *   },
 * };
 * ```
 */
export interface ChatAdapter {
	/** Declare what this adapter supports. */
	capabilities: ChatCapabilities;

	/**
	 * Load initial state on mount.
	 * Returns availability, optional active session, and messages.
	 * If not provided, the UI assumes `{ availability: { status: 'ready' } }`.
	 */
	loadInitialState?(): Promise<ChatInitialState>;

	/**
	 * Send a user message and get the response.
	 * This is the only required async method.
	 */
	sendMessage(input: SendMessageInput): Promise<SendMessageResult>;

	/**
	 * Continue a multi-turn response (tool calling, etc.).
	 * Called when `sendMessage` returns `completed: false`.
	 * If not provided, multi-turn is not supported.
	 */
	continueResponse?(sessionId: string): Promise<ContinueResult>;

	/**
	 * Subscribe to streaming response chunks.
	 * Called instead of polling when `capabilities.streaming` is true.
	 * Returns an unsubscribe function.
	 */
	onStream?(sessionId: string, callback: (chunk: StreamChunk) => void): () => void;

	/**
	 * List available sessions.
	 * Only called when `capabilities.sessions` is true.
	 */
	listSessions?(limit?: number): Promise<ChatSession[]>;

	/**
	 * Load messages for a specific session.
	 * Only called when `capabilities.history` is true.
	 */
	loadMessages?(sessionId: string): Promise<ChatMessage[]>;

	/**
	 * Create a new empty session.
	 * Only called when `capabilities.sessions` is true.
	 */
	createSession?(): Promise<ChatSession>;

	/**
	 * Delete a session.
	 * Only called when `capabilities.sessions` is true.
	 */
	deleteSession?(sessionId: string): Promise<void>;

	/**
	 * Clear all messages in a session (without deleting it).
	 */
	clearSession?(sessionId: string): Promise<void>;
}
