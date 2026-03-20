/**
 * Normalize raw backend messages into the ChatMessage format
 * used by the UI components.
 *
 * The backend stores tool calls and results as regular messages
 * with metadata.type = 'tool_call' | 'tool_result'. This normalizer
 * maps them into the package's role-based message model.
 */

import type { ChatMessage, ToolCall } from './types/message.ts';
import type { ChatSession } from './types/session.ts';
import type { RawMessage, RawSession } from './types/api.ts';

let idCounter = 0;
function generateId(): string {
	return `msg_${Date.now()}_${++idCounter}`;
}

/**
 * Normalize a raw backend message into a ChatMessage.
 */
export function normalizeMessage(raw: RawMessage, index: number): ChatMessage {
	const type = raw.metadata?.type ?? 'text';
	const timestamp = raw.metadata?.timestamp ?? new Date().toISOString();

	if (type === 'tool_call') {
		const toolCalls: ToolCall[] = [];

		// Extract from metadata (single tool call)
		if (raw.metadata?.tool_name) {
			toolCalls.push({
				id: `tc_${index}_${raw.metadata.tool_name}`,
				name: raw.metadata.tool_name,
				parameters: raw.metadata.parameters ?? {},
			});
		}

		// Also check top-level tool_calls array
		if (raw.tool_calls?.length) {
			for (const tc of raw.tool_calls) {
				// Avoid duplicates
				if (!toolCalls.some((t) => t.name === tc.tool_name)) {
					toolCalls.push({
						id: `tc_${index}_${tc.tool_name}`,
						name: tc.tool_name,
						parameters: tc.parameters ?? {},
					});
				}
			}
		}

		return {
			id: generateId(),
			role: 'tool_call',
			content: raw.content,
			timestamp,
			toolCalls,
		};
	}

	if (type === 'tool_result') {
		return {
			id: generateId(),
			role: 'tool_result',
			content: raw.content,
			timestamp,
			toolResult: {
				toolName: raw.metadata?.tool_name ?? 'unknown',
				success: raw.metadata?.success ?? false,
			},
		};
	}

	// Regular text message (user or assistant)
	const message: ChatMessage = {
		id: generateId(),
		role: raw.role === 'user' ? 'user' : 'assistant',
		content: raw.content,
		timestamp,
	};

	// Assistant messages may carry tool_calls at the top level
	if (raw.role === 'assistant' && raw.tool_calls?.length) {
		message.toolCalls = raw.tool_calls.map((tc, i) => ({
			id: `tc_${index}_${i}_${tc.tool_name}`,
			name: tc.tool_name,
			parameters: tc.parameters ?? {},
		}));
	}

	return message;
}

/**
 * Normalize a full conversation array.
 */
export function normalizeConversation(raw: RawMessage[]): ChatMessage[] {
	return raw.map(normalizeMessage);
}

/**
 * Normalize a raw session into a ChatSession.
 */
export function normalizeSession(raw: RawSession): ChatSession {
	return {
		id: raw.session_id,
		title: raw.title ?? raw.first_message ?? undefined,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		messageCount: raw.message_count,
	};
}
