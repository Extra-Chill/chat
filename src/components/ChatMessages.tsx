import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat } from '../types/index.ts';
import { buildMessageTimeline } from '../tool-timeline.ts';
import { ChatMessage } from './ChatMessage.tsx';
import { ToolMessage, type ToolRenderer, type ToolRendererContext } from './ToolMessage.tsx';

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
	/**
	 * Custom renderers for specific tool names.
	 *
	 * Map tool function names to React render functions. When a tool group
	 * matches a registered name, the custom renderer is used instead of
	 * the default `ToolMessage` JSON display.
	 *
	 * @example
	 * ```tsx
	 * toolRenderers={{
	 *   edit_post_blocks: (group) => <DiffCard diff={parseDiff(group)} />,
	 *   replace_post_blocks: (group) => <DiffCard diff={parseDiff(group)} />,
	 * }}
	 * ```
	 */
	toolRenderers?: Record<string, ToolRenderer>;
	/** Action context passed to custom tool renderers. */
	toolRendererContext?: ToolRendererContext;
	/** Whether to auto-scroll to bottom on new messages. Defaults to true. */
	autoScroll?: boolean;
	/** Placeholder content shown when there are no messages. */
	emptyState?: ReactNode;
	/** Content rendered at the end of the message flow before the scroll anchor. */
	footer?: ReactNode;
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
	toolRenderers,
	toolRendererContext,
	autoScroll = true,
	emptyState,
	footer,
	className,
}: ChatMessagesProps) {
	const bottomRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!autoScroll || !containerRef.current) return;

		// Scroll within the container, not the whole page.
		const container = containerRef.current;
		container.scrollTo({
			top: container.scrollHeight,
			behavior: 'smooth',
		});
	}, [messages, footer, autoScroll]);

	const displayItems = buildMessageTimeline(messages, { showTools });
	const baseClass = 'ec-chat-messages';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const rendererContext = toolRendererContext ?? {
		sendMessage: () => {},
		isLoading: false,
	};

	if (displayItems.length === 0 && emptyState) {
		return (
			<div className={classes} ref={containerRef}>
				<div className={`${baseClass}__empty`}>
					{emptyState}
				</div>
				{footer}
				<div ref={bottomRef} />
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
					const customRenderer = toolRenderers?.[item.group.toolName];
					if (customRenderer) {
						return (
							<div key={item.group.callMessage.id}>
								{customRenderer(item.group, rendererContext)}
							</div>
						);
					}

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
			{footer}
			<div ref={bottomRef} />
		</div>
	);
}
