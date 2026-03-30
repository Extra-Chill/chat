/**
 * Chat session types.
 *
 * Sessions are optional — adapters that don't support sessions
 * operate in single-conversation mode.
 */

import type { ChatMessage } from './message.ts';

/**
 * A chat session — a distinct conversation thread.
 */
export interface ChatSession {
	/** Unique session identifier. */
	id: string;
	/** Human-readable title (may be auto-generated from first message). */
	title?: string;
	/** ISO 8601 timestamp of session creation. */
	createdAt: string;
	/** ISO 8601 timestamp of last activity. */
	updatedAt: string;
	/** Number of messages in the session (optional, for display). */
	messageCount?: number;
	/** Number of unread assistant messages (0 when fully read). */
	unreadCount?: number;
}

/**
 * Availability state of the chat service.
 *
 * Adapters surface this so the UI can render appropriate states
 * without knowing the business logic behind them.
 */
export type ChatAvailability =
	| { status: 'ready' }
	| { status: 'login-required'; loginUrl?: string }
	| { status: 'unavailable'; reason?: string }
	| { status: 'provisioning'; message?: string }
	| { status: 'upgrade-required'; upgradeUrl?: string; message?: string }
	| { status: 'error'; message: string };

/**
 * The initial state returned by an adapter on mount.
 */
export interface ChatInitialState {
	/** Current availability of the chat service. */
	availability: ChatAvailability;
	/** Active session (if resuming). */
	session?: ChatSession;
	/** Messages for the active session (if resuming). */
	messages?: ChatMessage[];
}
