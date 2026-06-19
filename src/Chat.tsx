import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat, ToolCall } from './types/index.ts';
import type { FetchFn, MediaUploadFn } from './api.ts';
import type { ChatRunAdapter } from './run-control.ts';
import type { ToolRenderer } from './components/ToolMessage.tsx';
import { useChat, type UseChatOptions } from './hooks/useChat.ts';
import { useLoadingMessages, type LoadingMessagesConfig } from './hooks/useLoadingMessages.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AvailabilityGate } from './components/AvailabilityGate.tsx';
import { ChatMessages, type ShapeRenderer } from './components/ChatMessages.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { TypingIndicator } from './components/TypingIndicator.tsx';
import { SessionSwitcher } from './components/SessionSwitcher.tsx';
import { MessageSuggestions, type ChatMessageSuggestion } from './components/MessageSuggestions.tsx';
import type { UseChatReturn } from './hooks/useChat.ts';
import { useClientContextMetadata, type ClientContextMetadataOptions } from './client-context.ts';

export type ChatSessionUi = 'list' | 'none';

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getClientContextPayload(
	metadata: Record<string, unknown>,
	options: ClientContextMetadataOptions | undefined,
): Record<string, unknown> | undefined {
	const metadataKey = options?.metadataKey ?? 'client_context';
	const payload = metadata[metadataKey];
	if (isRecord(payload)) {
		return payload;
	}

	return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export interface ChatProps {
	/** Adapter that owns chat transport and backend-specific behavior. */
	adapter?: UseChatOptions['adapter'];
	/**
	 * Base path for the default REST adapter. Required when `adapter` is not provided.
	 */
	basePath?: string;
	/**
	 * Fetch function for the default REST adapter. Required when `adapter` is not provided.
	 */
	fetchFn?: FetchFn;
	/**
	 * Agent ID to scope the chat to.
	 */
	agentId?: number;
	/** Content format for message rendering. Defaults to 'markdown'. */
	contentFormat?: ContentFormat;
	/** Custom content renderer for messages. */
	renderContent?: (content: string, role: ChatMessageType['role']) => ReactNode;
	/** Whether to display tool call/result messages. Defaults to true. */
	showTools?: boolean;
	/** Map of tool function names to friendly display labels. */
	toolNames?: Record<string, string>;
	/**
	 * Custom renderers for specific tool names.
	 *
	 * Map tool function names to React render functions. When a tool group
	 * matches a registered name, the custom renderer is used instead of
	 * the default ToolMessage JSON display.
	 */
	toolRenderers?: Record<string, ToolRenderer>;
	/**
	 * Ordered list of shape-detecting renderers, tried when no tool-name
	 * renderer in `toolRenderers` matches a tool group.
	 *
	 * Unlike `toolRenderers` (keyed by tool *name*), these dispatch off the
	 * *shape* of a tool group's result — so any tool whose result carries a
	 * recognized payload (e.g. a `{question, choices}` shape) renders the same
	 * way, with zero hardcoded tool names. Forwarded to {@link ChatMessages}.
	 */
	shapeRenderers?: ShapeRenderer[];
	/** Placeholder text for the input. */
	placeholder?: string;
	/** Content shown when conversation is empty. */
	emptyState?: ReactNode;
	/** Suggested messages shown when the conversation is empty. */
	messageSuggestions?: ChatMessageSuggestion[];
	/** Accessible label for suggested messages. */
	messageSuggestionsLabel?: string;
	/** Initial messages (hydrated from server). */
	initialMessages?: ChatMessageType[];
	/** Initial session ID. */
	initialSessionId?: string;
	/** Maximum continuation turns. */
	maxContinueTurns?: number;
	/** Called when an error occurs. */
	onError?: UseChatOptions['onError'];
	/** Called when a new message is added. */
	onMessage?: UseChatOptions['onMessage'];
	/**
	 * Called with the tool calls emitted by every assistant turn.
	 *
	 * Fires once per continuation batch with a flat array of
	 * {@link ToolCall} records. Use this to react to server-side side
	 * effects (e.g. invalidate a TanStack Query cache when a tool
	 * mutates server state).
	 */
	onToolCalls?: (toolCalls: ToolCall[]) => void;
	/** Called with response-level metadata returned by the backend. */
	onResponseMetadata?: UseChatOptions['onResponseMetadata'];
	/**
	 * Session-list scope filter passed to the backend.
	 *
	 * The chat REST contract accepts a `context` query param on
	 * `/sessions` so multiple chat surfaces (e.g. a sidebar in the
	 * admin UI and a floating widget on the frontend) can share a
	 * store without cross-contaminating their session lists. The value
	 * is opaque to this package — the backend decides how to scope.
	 */
	sessionContext?: string;
	/** Additional CSS class name on the root element. */
	className?: string;
	/** Whether to show the session switcher. Defaults to true. */
	showSessions?: boolean;
	/** Session UI mode. 'list' renders the built-in switcher, 'none' lets the consumer render its own. */
	sessionUi?: ChatSessionUi;
	/** Visible title for the built-in session switcher. */
	sessionSwitcherTitle?: string;
	/** Accessible label for the built-in session select. */
	sessionSwitcherSelectLabel?: string;
	/** Label shown during multi-turn processing. */
	processingLabel?: (turnCount: number) => string;
	/**
	 * Cycling loading messages shown while the assistant is thinking.
	 *
	 * - `true` — enable with built-in defaults.
	 * - `LoadingMessagesConfig` — extend or override the default pool.
	 * - `false` / `undefined` — disabled (dots only, original behavior).
	 *
	 * When enabled alongside `processingLabel`, loading messages are shown
	 * on the initial turn (turnCount === 0) and `processingLabel` takes
	 * over during multi-turn continuation.
	 */
	loadingMessages?: boolean | LoadingMessagesConfig;
	/**
	 * Whether to show the attachment button in the input.
	 *
	 * Defaults to `true` when `mediaUploadFn` is provided, `false` otherwise.
	 * The attach button is hidden when no upload function is configured because
	 * files cannot be processed without one.
	 */
	allowAttachments?: boolean;
	/** Accepted file types for attachments. Defaults to 'image/*,video/*'. */
	acceptFileTypes?: string;
	/**
	 * Upload function for file attachments.
	 *
	 * Called for each file the user attaches before the message is sent.
	 * Must upload the file and return a URL and/or media ID.
	 * When not provided, the attach button is hidden.
	 *
	 * The upload function is owned by the consumer because storage and
	 * authorization are backend-specific.
	 */
	mediaUploadFn?: MediaUploadFn;
	/** Optional adapter that supplies long-running turn controls. */
	runAdapter?: ChatRunAdapter;
	/** Optional long-running turn capabilities supplied by the backend adapter. */
	runCapabilities?: UseChatOptions['runCapabilities'];
	/** Active backend run ID, when the adapter already knows it. */
	activeRunId?: UseChatOptions['activeRunId'];
	/** Extract a backend run ID from response metadata. */
	getRunId?: UseChatOptions['getRunId'];
	/** Cancel the active backend run. Called only when cancel support is enabled. */
	onCancelRun?: UseChatOptions['onCancelRun'];
	/** Queue a follow-up message. Called only when queue support is enabled. */
	onQueueMessage?: UseChatOptions['onQueueMessage'];
	/** Accessible label for the stop/cancel control. */
	cancelLabel?: string;
	/**
	 * Arbitrary metadata forwarded to the backend with each message.
	 * Use for client-side context injection (e.g. `{ clientContext: { tab: 'compose' } }`).
	 */
	metadata?: Record<string, unknown>;
	/** Include registered client-context metadata with each sent message. Defaults to false. */
	clientContext?: boolean;
	/** Configure the automatically collected client-context metadata payload. */
	clientContextOptions?: ClientContextMetadataOptions;
	/** Deprecated: built-in copy transcript button UI is no longer rendered. */
	showCopyTranscript?: boolean;
	/** Deprecated legacy prop retained for compatibility. */
	copyTranscriptLabel?: string;
	/** Deprecated legacy prop retained for compatibility. */
	copyTranscriptCopiedLabel?: string;
	/** Optional custom header/actions area rendered above messages with live chat state. */
	renderHeader?: ( chat: UseChatReturn ) => ReactNode;
	/**
	 * Called whenever the total unread count across all sessions changes.
	 * Use this to drive external unread indicators (e.g. FAB badge).
	 */
	onUnreadChange?: (totalUnread: number) => void;
	/**
	 * Whether the chat UI is currently visible to the user.
	 * When `false`, incoming messages increment unread count.
	 * When transitioning from `false` to `true`, auto-calls `markAsRead()`
	 * for the active session.
	 */
	isVisible?: boolean;
}

/**
 * Ready-to-use chat component.
 *
 * Composes all the primitives (messages, input, typing, sessions, etc.)
 * into a complete chat experience. For full control, use the individual
	 * components and `useChat` hook directly.
	 *
	 * @example
	 * ```tsx
	 * import { Chat } from '@extrachill/chat';
	 *
	 * function ChatSurface() {
	 *   return (
	 *     <Chat
	 *       basePath="/chat"
	 *       fetchFn={fetchChatJson}
	 *     />
 *   );
 * }
 * ```
 */
export function Chat({
	adapter,
	basePath,
	fetchFn,
	agentId,
	contentFormat = 'markdown',
	renderContent,
	showTools = true,
	toolNames,
	toolRenderers,
	shapeRenderers,
	placeholder,
	emptyState,
	messageSuggestions,
	messageSuggestionsLabel,
	initialMessages,
	initialSessionId,
	maxContinueTurns,
	onError,
	onMessage,
	onToolCalls,
	onResponseMetadata,
	sessionContext,
	className,
	showSessions = true,
	sessionUi = 'list',
	sessionSwitcherTitle,
	sessionSwitcherSelectLabel,
	processingLabel,
	loadingMessages,
	allowAttachments,
	acceptFileTypes,
	mediaUploadFn,
	runAdapter,
	runCapabilities,
	activeRunId,
	getRunId,
	onCancelRun,
	onQueueMessage,
	cancelLabel,
	metadata,
	clientContext = false,
	clientContextOptions,
	showCopyTranscript = false,
	copyTranscriptLabel,
	copyTranscriptCopiedLabel,
	renderHeader,
	onUnreadChange,
	isVisible = true,
}: ChatProps) {
	// Attachments are only functional when a mediaUploadFn is provided.
	const resolvedAllowAttachments = allowAttachments ?? !!mediaUploadFn;
	const clientContextMetadata = useClientContextMetadata(clientContextOptions);
	const resolvedClientContext = useMemo(
		() => clientContext
			? getClientContextPayload(clientContextMetadata, clientContextOptions)
			: undefined,
		[clientContext, clientContextMetadata, clientContextOptions],
	);

	const chat = useChat({
		adapter,
		basePath,
		fetchFn,
		agentId,
		initialMessages,
		initialSessionId,
		maxContinueTurns,
		onError,
		onMessage,
		onToolCalls,
		onResponseMetadata,
		sessionContext,
		metadata,
		clientContext: resolvedClientContext,
		mediaUploadFn,
		runAdapter,
		runCapabilities,
		activeRunId,
		getRunId,
		onCancelRun,
		onQueueMessage,
	});

	// Fire onUnreadChange whenever totalUnreadCount changes.
	useEffect(() => {
		onUnreadChange?.(chat.totalUnreadCount);
	}, [chat.totalUnreadCount, onUnreadChange]);

	// Auto-mark active session as read when chat becomes visible.
	const prevVisibleRef = useRef(isVisible);
	useEffect(() => {
		const wasHidden = !prevVisibleRef.current;
		prevVisibleRef.current = isVisible;

		if (wasHidden && isVisible && chat.sessionId) {
			chat.markAsRead();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isVisible]);

	// Resolve loading messages config.
	const loadingMessagesConfig: LoadingMessagesConfig | undefined =
		loadingMessages === true ? {} :
		loadingMessages ? loadingMessages :
		undefined;

	const cycling = useLoadingMessages(
		chat.isLoading && !!loadingMessagesConfig,
		loadingMessagesConfig,
	);
	const hasLoadingMessages = !!loadingMessagesConfig;

	const baseClass = 'ec-chat';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const resolvedMessageSuggestions = messageSuggestions ?? [];
	const hasVisibleMessages = chat.messages.some((message) => message.role !== 'system');
	const showMessageSuggestions = resolvedMessageSuggestions.length > 0 && !hasVisibleMessages;
	const resolvedEmptyState = showMessageSuggestions ? (
		<div className={`${baseClass}__empty-with-suggestions`}>
			{emptyState}
			<MessageSuggestions
				suggestions={resolvedMessageSuggestions}
				onSelect={(suggestion) => chat.sendMessage(suggestion.message ?? suggestion.label)}
				label={messageSuggestionsLabel}
				disabled={chat.isLoading && !chat.canQueueMessage}
			/>
		</div>
	) : emptyState;
	const typingIndicator = useMemo(() => (
		<TypingIndicator
			visible={chat.isLoading}
			label={
				hasLoadingMessages
					? cycling.message
					: chat.turnCount > 0
					? (processingLabel
						? processingLabel(chat.turnCount)
						: `Processing turn ${chat.turnCount}...`)
					: undefined
			}
		/>
	), [chat.isLoading, chat.turnCount, processingLabel, hasLoadingMessages, cycling.message]);

	return (
		<ErrorBoundary onError={onError ? (err) => onError(err) : undefined}>
			<div className={classes}>
				<AvailabilityGate availability={chat.availability}>
					{renderHeader?.( chat )}

					{showSessions && sessionUi === 'list' && (
						<SessionSwitcher
							sessions={chat.sessions}
							activeSessionId={chat.sessionId ?? undefined}
							onSelect={chat.switchSession}
							onNew={chat.newSession}
							onDelete={chat.deleteSession}
							loading={chat.sessionsLoading}
							title={sessionSwitcherTitle}
							selectLabel={sessionSwitcherSelectLabel}
						/>
					)}

				<ChatMessages
					messages={chat.messages}
					contentFormat={contentFormat}
					renderContent={renderContent}
					showTools={showTools}
					toolNames={toolNames}
					toolRenderers={toolRenderers}
					shapeRenderers={shapeRenderers}
					toolRendererContext={{
						sendMessage: chat.sendMessage,
						isLoading: chat.isLoading,
					}}
					emptyState={resolvedEmptyState}
					footer={typingIndicator}
				/>

					<ChatInput
						onSend={chat.sendMessage}
						onCancel={chat.cancelRun}
						disabled={chat.isLoading && !chat.canQueueMessage}
						showCancel={chat.canCancelRun}
						cancelLoading={chat.isCancelling}
						cancelLabel={cancelLabel}
						placeholder={placeholder}
						allowAttachments={resolvedAllowAttachments}
						accept={acceptFileTypes}
					/>
				</AvailabilityGate>
			</div>
		</ErrorBoundary>
	);
}
