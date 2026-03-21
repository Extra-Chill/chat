/**
 * Normalized message model for the chat package.
 *
 * This model is backend-agnostic. Adapters map their native message
 * format into these types before the UI sees them.
 */

/**
 * The role that produced a message.
 *
 * - `user` — sent by the human
 * - `assistant` — sent by the AI / bot
 * - `system` — system-level context (usually hidden from UI)
 * - `tool_call` — the assistant requesting a tool execution
 * - `tool_result` — the result of a tool execution
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool_call' | 'tool_result';

/**
 * A single tool call requested by the assistant.
 */
export interface ToolCall {
	/** Unique ID for this tool call (used to pair with result). */
	id: string;
	/** Tool function name. */
	name: string;
	/** Arguments passed to the tool. */
	parameters: Record<string, unknown>;
}

/**
 * Metadata for a tool result message.
 */
export interface ToolResultMeta {
	/** The tool that produced this result. */
	toolName: string;
	/** Whether the tool call succeeded. */
	success: boolean;
}

/**
 * A media attachment on a chat message (image, video, or file).
 */
export interface MediaAttachment {
	/** Media type. */
	type: 'image' | 'video' | 'file';
	/** Public URL of the media. */
	url: string;
	/** Alt text or description. */
	alt?: string;
	/** Original filename. */
	filename?: string;
	/** MIME type (e.g. 'image/jpeg'). */
	mimeType?: string;
	/** File size in bytes. */
	size?: number;
	/** WordPress media library attachment ID. */
	mediaId?: number;
	/** Thumbnail URL for previews. */
	thumbnailUrl?: string;
}

/**
 * A single message in a chat conversation.
 */
export interface ChatMessage {
	/** Unique message ID. */
	id: string;
	/** Who produced this message. */
	role: MessageRole;
	/** Text content (may be markdown, HTML, or plain text depending on adapter). */
	content: string;
	/** ISO 8601 timestamp. */
	timestamp: string;
	/** Tool calls requested by the assistant (only on assistant messages). */
	toolCalls?: ToolCall[];
	/** Tool result metadata (only on tool_result messages). */
	toolResult?: ToolResultMeta;
	/** Media attachments (images, videos, files) on this message. */
	attachments?: MediaAttachment[];
}

/**
 * Content format hint for how message content should be rendered.
 *
 * - `markdown` — render with a markdown renderer (default)
 * - `html` — render as raw HTML (dangerouslySetInnerHTML)
 * - `text` — render as plain text
 */
export type ContentFormat = 'markdown' | 'html' | 'text';
