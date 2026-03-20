import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat } from '../types/index.ts';
import { ChatMessage } from './ChatMessage.tsx';
import { ToolMessage, type ToolGroup } from './ToolMessage.tsx';

export interface ChatMessagesProps {
	/** All messages in the conversation. */
	messages: ChatMessageType[];
	/** How to render message content. Defaults to 'markdown'. */
	contentFormat?: ContentFormat;
	/** Custom content renderer passed through to ChatMessage. */
	renderContent?: (content: string, role: ChatMessageType['role']) => ReactNode;
	/** Whether to show tool call/result messages. Defaults to false. */
	showTools?: boolean;
	/** Custom tool name display map. Maps tool function names to friendly labels. */
	toolNames?: Record<string, string>;
	/** Whether to auto-scroll to bottom on new messages. Defaults to true. */
	autoScroll?: boolean;
	/** Placeholder content shown when there are no messages. */
	emptyState?: ReactNode;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Scrollable message list with auto-scroll behavior.
 *
 * Filters system messages, groups tool_call/tool_result pairs,
 * and renders user/assistant messages as ChatMessage components.
 */
export function ChatMessages({
	messages,
	contentFormat,
	renderContent,
	showTools = false,
	toolNames,
	autoScroll = true,
	emptyState,
	className,
}: ChatMessagesProps) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (autoScroll && bottomRef.current) {
			bottomRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [messages, autoScroll]);

	const displayItems = buildDisplayItems(messages, showTools);
	const baseClass = 'ec-chat-messages';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	if (displayItems.length === 0 && emptyState) {
		return (
			<div className={classes} ref={containerRef}>
				<div className={`${baseClass}__empty`}>
					{emptyState}
				</div>
			</div>
		);
	}

	return (
		<div className={classes} ref={containerRef}>
			{displayItems.map((item) => {
				if (item.type === 'message') {
					return (
						<ChatMessage
							key={item.message.id}
							message={item.message}
							contentFormat={contentFormat}
							renderContent={renderContent}
						/>
					);
				}

				if (item.type === 'tool-group' && showTools) {
					return (
						<ToolMessage
							key={item.group.callMessage.id}
							group={item.group}
							toolNames={toolNames}
						/>
					);
				}

				return null;
			})}
			<div ref={bottomRef} />
		</div>
	);
}

type DisplayItem =
	| { type: 'message'; message: ChatMessageType }
	| { type: 'tool-group'; group: ToolGroup };

/**
 * Build display items from raw messages.
 *
 * - Filters out system messages
 * - Groups tool_call + tool_result pairs
 * - Returns ordered display items
 */
function buildDisplayItems(messages: ChatMessageType[], showTools: boolean): DisplayItem[] {
	const items: DisplayItem[] = [];
	const toolResultMap = new Map<string, ChatMessageType>();

	// Pre-index tool results by tool name for pairing
	if (showTools) {
		for (const msg of messages) {
			if (msg.role === 'tool_result' && msg.toolResult?.toolName) {
				toolResultMap.set(msg.toolResult.toolName, msg);
			}
		}
	}

	const processedToolResults = new Set<string>();

	for (const msg of messages) {
		// Skip system messages
		if (msg.role === 'system') continue;

		// Skip tool messages when tools are hidden
		if (!showTools && (msg.role === 'tool_call' || msg.role === 'tool_result')) continue;

		// Handle user/assistant messages (assistant messages with toolCalls get both treatments)
		if (msg.role === 'user' || msg.role === 'assistant') {
			// If assistant message has tool calls, render the text part as a message
			// and the tool calls as tool groups
			if (msg.role === 'assistant' && msg.toolCalls?.length && showTools) {
				// Only render text bubble if there's actual text content
				if (msg.content.trim()) {
					items.push({ type: 'message', message: msg });
				}

				for (const call of msg.toolCalls) {
					const resultMsg = toolResultMap.get(call.name);
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
			continue;
		}

		// Handle standalone tool_call messages
		if (msg.role === 'tool_call' && showTools) {
			const toolName = msg.toolCalls?.[0]?.name ?? 'unknown';
			const resultMsg = toolResultMap.get(toolName);
			if (resultMsg) {
				processedToolResults.add(resultMsg.id);
			}

			items.push({
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

		// Handle orphaned tool_result messages
		if (msg.role === 'tool_result' && showTools && !processedToolResults.has(msg.id)) {
			items.push({ type: 'message', message: msg });
		}
	}

	return items;
}
