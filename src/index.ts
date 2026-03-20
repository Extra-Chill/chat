// Types
export type {
	MessageRole,
	ToolCall,
	ToolResultMeta,
	ChatMessage,
	ContentFormat,
	ChatSession,
	ChatAvailability,
	ChatInitialState,
	ChatCapabilities,
	SendMessageInput,
	SendMessageResult,
	ContinueResult,
	StreamChunk,
	ChatAdapter,
} from './types/index.ts';

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
