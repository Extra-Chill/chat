// Types
export type {
	MessageRole,
	ToolCall,
	ToolResultMeta,
	MediaAttachment,
	ChatMessage,
	ContentFormat,
	ChatSession,
	ChatAvailability,
	ChatInitialState,
	RawAttachment,
	RawMessage,
	RawSession,
	SessionMetadata,
} from './types/index.ts';

// API
export type { FetchFn, FetchOptions, ChatApiConfig, SendResult, ContinueResult, SendAttachment, MediaUploadFn } from './api.ts';
export {
	sendMessage,
	continueResponse,
	listSessions,
	loadSession,
	deleteSession,
	markSessionRead,
} from './api.ts';

// Normalizer
export { normalizeMessage, normalizeConversation, normalizeSession } from './normalizer.ts';

// Markdown
export { markdownToHtml } from './markdown.ts';

// Transcript
export { formatChatAsMarkdown, copyChatAsMarkdown } from './transcript.ts';

// Tool timeline primitives
export {
	buildMessageTimeline,
	buildToolGroups,
	type MessageTimelineItem,
	type MessageTimelineOptions,
	type ToolGroup,
} from './tool-timeline.ts';

// Diff helpers
export {
	parseCanonicalDiff,
	parseCanonicalDiffFromJson,
	parseCanonicalDiffFromToolGroup,
	type CanonicalDiffData,
	type CanonicalDiffEditorData,
	type CanonicalDiffItem,
	type CanonicalDiffStatus,
	type CanonicalDiffType,
} from './diff.ts';

// Client context
export {
	getOrCreateClientContextRegistry,
	registerClientContextProvider,
	getClientContextMetadata,
	useClientContextMetadata,
	type ClientContextProvider,
	type ClientContextProviderSnapshot,
	type ClientContextSnapshot,
	type ClientContextRegistry,
} from './client-context.ts';

// Components
export {
	ChatMessage as ChatMessageComponent,
	type ChatMessageProps,
} from './components/ChatMessage.tsx';

export {
	ChatMessages,
	type ChatMessagesProps,
} from './components/ChatMessages.tsx';

export {
	ChatInput,
	type ChatInputProps,
} from './components/ChatInput.tsx';

export {
	CopyTranscriptButton,
	type CopyTranscriptButtonProps,
} from './components/CopyTranscriptButton.tsx';

export {
	ToolMessage,
	type ToolMessageProps,
	type ToolRenderer,
	type ToolRendererContext,
} from './components/ToolMessage.tsx';

export {
	QuestionCard,
	type QuestionCardProps,
	type QuestionChoice,
} from './components/QuestionCard.tsx';

export {
	DiffCard,
	type DiffCardProps,
	type DiffData,
} from './components/DiffCard.tsx';

export {
	TypingIndicator,
	type TypingIndicatorProps,
} from './components/TypingIndicator.tsx';

export {
	SessionSwitcher,
	type SessionSwitcherProps,
} from './components/SessionSwitcher.tsx';

export {
	MessageSuggestions,
	type ChatMessageSuggestion,
	type MessageSuggestionsProps,
} from './components/MessageSuggestions.tsx';

export {
	AgentSwitcher,
	type AgentSwitcherAgent,
	type AgentSwitcherProps,
} from './components/AgentSwitcher.tsx';

export {
	ErrorBoundary,
	type ErrorBoundaryProps,
} from './components/ErrorBoundary.tsx';

export {
	AvailabilityGate,
	type AvailabilityGateProps,
} from './components/AvailabilityGate.tsx';

// Hooks
export {
	useChat,
	type ChatRun,
	type CancelRunInput,
	type ChatRunCapabilities,
	type ChatRunStatus,
	type QueueMessageInput,
	type QueueMessageResult,
	type UseChatOptions,
	type UseChatReturn,
} from './hooks/useChat.ts';

export {
	useLoadingMessages,
	DEFAULT_LOADING_MESSAGES,
	type LoadingMessagesConfig,
	type UseLoadingMessagesReturn,
} from './hooks/useLoadingMessages.ts';

// Composed
export { Chat, type ChatProps, type ChatSessionUi } from './Chat.tsx';
