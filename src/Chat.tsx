import { type ReactNode } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat } from './types/index.ts';
import type { FetchFn, MediaUploadFn } from './api.ts';
import type { ToolGroup } from './components/ToolMessage.tsx';
import { useChat, type UseChatOptions } from './hooks/useChat.ts';
import { useLoadingMessages, type LoadingMessagesConfig } from './hooks/useLoadingMessages.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AvailabilityGate } from './components/AvailabilityGate.tsx';
import { ChatMessages } from './components/ChatMessages.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { TypingIndicator } from './components/TypingIndicator.tsx';
import { SessionSwitcher } from './components/SessionSwitcher.tsx';
import type { UseChatReturn } from './hooks/useChat.ts';

export type ChatSessionUi = 'list' | 'none';

export interface ChatProps {
	/**
	 * Base path for the chat REST endpoints.
	 * e.g. '/datamachine/v1/chat'
	 */
	basePath: string;
	/**
	 * Fetch function for API calls. Must accept { path, method?, data? }
	 * and return parsed JSON. @wordpress/api-fetch works directly.
	 */
	fetchFn: FetchFn;
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
	toolRenderers?: Record<string, (group: ToolGroup) => ReactNode>;
	/** Placeholder text for the input. */
	placeholder?: string;
	/** Content shown when conversation is empty. */
	emptyState?: ReactNode;
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
	/** Additional CSS class name on the root element. */
	className?: string;
	/** Whether to show the session switcher. Defaults to true. */
	showSessions?: boolean;
	/** Session UI mode. 'list' renders the built-in switcher, 'none' lets the consumer render its own. */
	sessionUi?: ChatSessionUi;
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
	 * @example
	 * ```tsx
	 * <Chat
	 *   mediaUploadFn={async (file) => {
	 *     const formData = new FormData();
	 *     formData.append('file', file);
	 *     const media = await apiFetch({ path: '/wp/v2/media', method: 'POST', body: formData });
	 *     return { url: media.source_url, media_id: media.id };
	 *   }}
	 * />
	 * ```
	 */
	mediaUploadFn?: MediaUploadFn;
	/**
	 * Arbitrary metadata forwarded to the backend with each message.
	 * Use for client-side context injection (e.g. `{ client_context: { tab: 'compose', postId: 123 } }`).
	 */
	metadata?: Record<string, unknown>;
	/** Deprecated: built-in copy transcript button UI is no longer rendered. */
	showCopyTranscript?: boolean;
	/** Deprecated legacy prop retained for compatibility. */
	copyTranscriptLabel?: string;
	/** Deprecated legacy prop retained for compatibility. */
	copyTranscriptCopiedLabel?: string;
	/** Optional custom header/actions area rendered above messages with live chat state. */
	renderHeader?: ( chat: UseChatReturn ) => ReactNode;
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
 * import apiFetch from '@wordpress/api-fetch';
 *
 * function StudioChat() {
 *   return (
 *     <Chat
 *       basePath="/datamachine/v1/chat"
 *       fetchFn={apiFetch}
 *       agentId={5}
 *     />
 *   );
 * }
 * ```
 */
export function Chat({
	basePath,
	fetchFn,
	agentId,
	contentFormat = 'markdown',
	renderContent,
	showTools = true,
	toolNames,
	toolRenderers,
	placeholder,
	emptyState,
	initialMessages,
	initialSessionId,
	maxContinueTurns,
	onError,
	onMessage,
	className,
	showSessions = true,
	sessionUi = 'list',
	processingLabel,
	loadingMessages,
	allowAttachments,
	acceptFileTypes,
	mediaUploadFn,
	metadata,
	showCopyTranscript = false,
	copyTranscriptLabel,
	copyTranscriptCopiedLabel,
	renderHeader,
}: ChatProps) {
	// Attachments are only functional when a mediaUploadFn is provided.
	const resolvedAllowAttachments = allowAttachments ?? !!mediaUploadFn;

	const chat = useChat({
		basePath,
		fetchFn,
		agentId,
		initialMessages,
		initialSessionId,
		maxContinueTurns,
		onError,
		onMessage,
		metadata,
		mediaUploadFn,
	});

	// Resolve loading messages config.
	const loadingMessagesConfig: LoadingMessagesConfig | undefined =
		loadingMessages === true ? {} :
		loadingMessages ? loadingMessages :
		undefined;

	const cycling = useLoadingMessages(
		chat.isLoading && !!loadingMessagesConfig,
		loadingMessagesConfig,
	);

	const baseClass = 'ec-chat';
	const classes = [baseClass, className].filter(Boolean).join(' ');

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
						/>
					)}

				<ChatMessages
					messages={chat.messages}
					contentFormat={contentFormat}
					renderContent={renderContent}
					showTools={showTools}
					toolNames={toolNames}
					toolRenderers={toolRenderers}
					emptyState={emptyState}
				/>

					<TypingIndicator
						visible={chat.isLoading}
						label={
							chat.turnCount > 0
								? (processingLabel
									? processingLabel(chat.turnCount)
									: `Processing turn ${chat.turnCount}...`)
								: loadingMessagesConfig
									? cycling.message
									: undefined
						}
					/>

					<ChatInput
						onSend={chat.sendMessage}
						disabled={chat.isLoading}
						placeholder={placeholder}
						allowAttachments={resolvedAllowAttachments}
						accept={acceptFileTypes}
					/>
				</AvailabilityGate>
			</div>
		</ErrorBoundary>
	);
}
