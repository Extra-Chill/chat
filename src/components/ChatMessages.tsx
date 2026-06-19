import { useEffect, useRef, type ReactNode } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat } from '../types/index.ts';
import { buildMessageTimeline } from '../tool-timeline.ts';
import { parseQuestionPayloadFromToolGroup } from '../tool-renderers.tsx';
import { collectSuppressedQuestionRestatementIds } from '../question-suppression.ts';
import { ChatMessage } from './ChatMessage.tsx';
import { ToolMessage, type ToolRenderer, type ToolRendererContext } from './ToolMessage.tsx';

/**
 * A renderer that dispatches off the *shape* of a tool group rather than its
 * tool name. It must return `null` when the group does not match its expected
 * shape so the next shape renderer (or the default `ToolMessage`) can take over.
 *
 * It is structurally identical to `ToolRenderer`; the distinct alias documents
 * the contract that a shape renderer is safe to attempt on *any* tool group and
 * will opt out by returning `null` when the shape does not match.
 */
export type ShapeRenderer = ToolRenderer;

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
	/**
	 * Ordered list of shape-detecting renderers, tried when no tool-name
	 * renderer matches `group.toolName`.
	 *
	 * Unlike `toolRenderers` (keyed by tool *name*), these dispatch off the
	 * *shape* of a tool group's result — so any tool whose result carries a
	 * recognized payload (e.g. a `{question, choices}` shape) renders the same
	 * way, with zero hardcoded tool names. Each renderer must return `null`
	 * when it cannot handle the group; the first non-null result wins.
	 * If every shape renderer returns `null`, the default `ToolMessage` is used.
	 *
	 * @example
	 * ```tsx
	 * shapeRenderers={[createQuestionToolRenderer()]}
	 * ```
	 */
	shapeRenderers?: ShapeRenderer[];
	/** Action context passed to custom tool renderers. */
	toolRendererContext?: ToolRendererContext;
	/**
	 * Suppress an assistant text turn that merely restates the choices of an
	 * immediately-adjacent question card (see #65). When a tool group renders a
	 * `{question, choices}` card, a chatty model often ALSO narrates the same
	 * choices as a markdown bullet list; both render stacked and users answer
	 * the prose instead of clicking the card. With this on (the default), the
	 * redundant prose restatement is dropped and only the card renders.
	 *
	 * Detection is deterministic and conservative — it only drops prose that is
	 * clearly the same choice set restated as a list, never arbitrary follow-up
	 * prose. Requires `showTools` (the card itself only renders with tools on).
	 * Set to `false` to render every assistant turn verbatim.
	 *
	 * Defaults to `true`.
	 */
	suppressRedundantQuestionProse?: boolean;
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
	shapeRenderers,
	toolRendererContext,
	suppressRedundantQuestionProse = true,
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
	// When a question renders as an interactive card, drop an adjacent assistant
	// text turn that merely restates the same choices as prose (#65). The card
	// only renders with tools on, so suppression is scoped to that case.
	const suppressedMessageIds = showTools && suppressRedundantQuestionProse
		? collectSuppressedQuestionRestatementIds(displayItems, parseQuestionPayloadFromToolGroup)
		: null;
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
					if (suppressedMessageIds?.has(item.message.id)) {
						return null;
					}

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

					// No tool-name renderer matched. Try shape-detecting
					// renderers in order; the first non-null result wins.
					// Dispatch is by result shape, not tool name — so any tool
					// carrying a recognized payload renders the same way.
					if (shapeRenderers) {
						for (const shapeRenderer of shapeRenderers) {
							const rendered = shapeRenderer(item.group, rendererContext);
							if (rendered !== null && rendered !== undefined) {
								return (
									<div key={item.group.callMessage.id}>
										{rendered}
									</div>
								);
							}
						}
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
