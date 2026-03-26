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
export type { FetchFn, FetchOptions, ChatApiConfig, SendResult, ContinueResult, SendAttachment } from './api.ts';
export {
	sendMessage,
	continueResponse,
	listSessions,
	loadSession,
	deleteSession,
} from './api.ts';

// Normalizer
export { normalizeMessage, normalizeConversation, normalizeSession } from './normalizer.ts';

// Markdown
export { markdownToHtml } from './markdown.ts';

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
	ToolMessage,
	type ToolMessageProps,
	type ToolGroup,
} from './components/ToolMessage.tsx';

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
	ErrorBoundary,
	type ErrorBoundaryProps,
} from './components/ErrorBoundary.tsx';

export {
	AvailabilityGate,
	type AvailabilityGateProps,
} from './components/AvailabilityGate.tsx';

// Hook
export {
	useChat,
	type UseChatOptions,
	type UseChatReturn,
} from './hooks/useChat.ts';

// Composed
export { Chat, type ChatProps } from './Chat.tsx';
