import type { ChatMessage } from './types/index.ts';

/**
 * A paired tool call + result for display or custom timelines.
 */
export interface ToolGroup {
	/** The message containing the tool call. */
	callMessage: ChatMessage;
	/** The result message (null if still pending). */
	resultMessage: ChatMessage | null;
	/** Tool function name. */
	toolName: string;
	/** Parameters passed to the tool. */
	parameters: Record<string, unknown>;
	/** Whether the tool succeeded (null if pending). */
	success: boolean | null;
}

export type MessageTimelineItem =
	| { type: 'message'; message: ChatMessage }
	| { type: 'tool-group'; group: ToolGroup };

export interface MessageTimelineOptions {
	/** Whether to include tool call/result groups. Defaults to false. */
	showTools?: boolean;
}

/**
 * Build ordered message timeline items from normalized chat messages.
 *
 * System messages are hidden. Tool calls/results are paired by tool call ID
 * when available, then by tool name for backends that only provide names.
 */
export function buildMessageTimeline(
	messages: ChatMessage[],
	options: MessageTimelineOptions = {},
): MessageTimelineItem[] {
	const showTools = options.showTools ?? false;
	const items: MessageTimelineItem[] = [];
	const toolResultMap = new Map<string, ChatMessage[]>();
	const pendingStandaloneToolGroups: MessageTimelineItem[] = [];
	const flushPendingStandaloneTools = () => {
		if (pendingStandaloneToolGroups.length === 0) return;
		items.push(...pendingStandaloneToolGroups);
		pendingStandaloneToolGroups.length = 0;
	};

	if (showTools) {
		for (const msg of messages) {
			if (msg.role === 'tool_result' && msg.toolResult) {
				const key = toolResultKey(msg.toolResult.toolCallId, msg.toolResult.toolName);
				const results = toolResultMap.get(key) ?? [];
				results.push(msg);
				toolResultMap.set(key, results);
			}
		}
	}

	const processedToolResults = new Set<string>();

	for (const msg of messages) {
		if (msg.role === 'system') continue;

		if (!showTools && (msg.role === 'tool_call' || msg.role === 'tool_result')) continue;

		if (msg.role === 'user' || msg.role === 'assistant') {
			if (msg.role === 'user') {
				flushPendingStandaloneTools();
			}

			if (msg.role === 'assistant' && msg.toolCalls?.length && showTools) {
				if (msg.content.trim()) {
					items.push({ type: 'message', message: msg });
				}

				for (const call of msg.toolCalls) {
					const resultMsg = takeToolResult(toolResultMap, call.id, call.name);
					if (resultMsg) {
						processedToolResults.add(resultMsg.id);
					}

					items.push({
						type: 'tool-group',
						group: {
							callMessage: {
								...msg,
								content: '',
								toolCalls: [call],
							},
							resultMessage: resultMsg ?? null,
							toolName: call.name,
							parameters: call.parameters,
							success: resultMsg?.toolResult?.success ?? null,
						},
					});
				}
			} else {
				items.push({ type: 'message', message: msg });
			}

			if (msg.role === 'assistant') {
				flushPendingStandaloneTools();
			}
			continue;
		}

		if (msg.role === 'tool_call' && showTools) {
			const toolName = msg.toolCalls?.[0]?.name ?? 'unknown';
			const toolCallId = msg.toolCalls?.[0]?.id;
			const resultMsg = takeToolResult(toolResultMap, toolCallId, toolName);
			if (resultMsg) {
				processedToolResults.add(resultMsg.id);
			}

			pendingStandaloneToolGroups.push({
				type: 'tool-group',
				group: {
					callMessage: msg,
					resultMessage: resultMsg ?? null,
					toolName,
					parameters: msg.toolCalls?.[0]?.parameters ?? {},
					success: resultMsg?.toolResult?.success ?? null,
				},
			});
			continue;
		}

		if (msg.role === 'tool_result' && showTools && !processedToolResults.has(msg.id)) {
			flushPendingStandaloneTools();
			items.push({
				type: 'tool-group',
				group: {
					callMessage: msg,
					resultMessage: msg,
					toolName: msg.toolResult?.toolName ?? 'unknown',
					parameters: {},
					success: msg.toolResult?.success ?? null,
				},
			});
		}
	}

	flushPendingStandaloneTools();

	return items;
}

/**
 * Build only the tool groups from a normalized message list.
 */
export function buildToolGroups(messages: ChatMessage[]): ToolGroup[] {
	return buildMessageTimeline(messages, { showTools: true }).flatMap((item) => (
		item.type === 'tool-group' ? [item.group] : []
	));
}

function takeToolResult(
	toolResultMap: Map<string, ChatMessage[]>,
	toolCallId: string | undefined,
	toolName: string,
): ChatMessage | undefined {
	const results = toolResultMap.get(toolResultKey(toolCallId, toolName));
	return results?.shift();
}

function toolResultKey(toolCallId: string | undefined, toolName: string): string {
	return toolCallId ? `id:${toolCallId}` : `name:${toolName}`;
}
