/**
 * REST API contract types.
 *
 * These describe the expected shape of the chat REST endpoints.
 * Any backend that wants to work with this package implements
 * these same endpoints and response shapes.
 */

/**
 * A raw message as stored/returned by the backend.
 * The package normalizes these into ChatMessage before rendering.
 */
/**
 * A raw media attachment as returned by the backend.
 */
export interface RawAttachment {
	type?: string;
	url?: string;
	alt?: string;
	filename?: string;
	mime_type?: string;
	size?: number;
	media_id?: number;
	thumbnail_url?: string;
}

export interface RawMessage {
	role: 'user' | 'assistant';
	content: string;
	metadata?: {
		timestamp?: string;
		type?: 'text' | 'multimodal' | 'tool_call' | 'tool_result';
		tool_name?: string;
		parameters?: Record<string, unknown>;
		success?: boolean;
		error?: string;
		turn?: number;
		tool_data?: Record<string, unknown>;
		/** Attachments sent with the message. */
		attachments?: RawAttachment[];
		/** Media produced by tool results. */
		media?: RawAttachment[];
	};
	tool_calls?: Array<{
		tool_name: string;
		parameters: Record<string, unknown>;
	}>;
}

/**
 * POST /chat — Send a message.
 */
export interface SendRequest {
	message: string;
	session_id?: string;
	agent_id?: number;
	/** Media attachments to send with the message. */
	attachments?: Array<{
		url?: string;
		media_id?: number;
		mime_type?: string;
		filename?: string;
	}>;
}

export interface SendResponse {
	success: boolean;
	data: {
		session_id: string;
		response: string;
		tool_calls: Array<{
			tool_name: string;
			parameters: Record<string, unknown>;
		}>;
		conversation: RawMessage[];
		metadata: SessionMetadata;
		completed: boolean;
		max_turns: number;
		turn_number: number;
		max_turns_reached: boolean;
		warning?: string;
	};
}

/**
 * POST /chat/continue — Continue a multi-turn response.
 */
export interface ContinueRequest {
	session_id: string;
}

export interface ContinueResponse {
	success: boolean;
	data: {
		session_id: string;
		new_messages: RawMessage[];
		final_content: string;
		tool_calls: Array<{
			tool_name: string;
			parameters: Record<string, unknown>;
		}>;
		completed: boolean;
		turn_number: number;
		max_turns: number;
		max_turns_reached: boolean;
	};
}

/**
 * GET /chat/sessions — List sessions.
 */
export interface ListSessionsResponse {
	success: boolean;
	data: {
		sessions: RawSession[];
		total: number;
		limit: number;
		offset: number;
	};
}

export interface RawSession {
	session_id: string;
	title: string | null;
	context: string;
	first_message: string | null;
	message_count: number;
	unread_count?: number;
	created_at: string;
	updated_at: string;
}

/**
 * GET /chat/{session_id} — Get a single session.
 */
export interface GetSessionResponse {
	success: boolean;
	data: {
		session_id: string;
		conversation: RawMessage[];
		metadata: SessionMetadata;
	};
}

/**
 * DELETE /chat/{session_id} — Delete a session.
 */
export interface DeleteSessionResponse {
	success: boolean;
	data: {
		session_id: string;
		deleted: boolean;
	};
}

/**
 * Session metadata shape from the backend.
 */
export interface SessionMetadata {
	status?: 'pending' | 'processing' | 'completed' | 'error';
	started_at?: string;
	last_activity?: string;
	message_count?: number;
	current_turn?: number;
	has_pending_tools?: boolean;
	token_usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	error_message?: string;
}
