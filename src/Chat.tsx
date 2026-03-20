import { type ReactNode } from 'react';
import type { ChatAdapter, ChatMessage as ChatMessageType, ContentFormat } from './types/index.ts';
import { useChat, type UseChatOptions } from './hooks/useChat.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { AvailabilityGate } from './components/AvailabilityGate.tsx';
import { ChatMessages } from './components/ChatMessages.tsx';
import { ChatInput } from './components/ChatInput.tsx';
import { TypingIndicator } from './components/TypingIndicator.tsx';
import { SessionSwitcher } from './components/SessionSwitcher.tsx';

export interface ChatProps {
	/** The adapter for backend communication. */
	adapter: ChatAdapter;
	/** Content format for message rendering. Defaults to 'markdown'. */
	contentFormat?: ContentFormat;
	/** Custom content renderer for messages. */
	renderContent?: (content: string, role: ChatMessageType['role']) => ReactNode;
	/** Whether to display tool call/result messages. Defaults to adapter.capabilities.tools. */
	showTools?: boolean;
	/** Map of tool function names to friendly display labels. */
	toolNames?: Record<string, string>;
	/** Placeholder text for the input. */
	placeholder?: string;
	/** Content shown when conversation is empty. */
	emptyState?: ReactNode;
	/** Custom availability state renderer. */
	renderAvailability?: (availability: ChatAdapter['capabilities']) => ReactNode;
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
	/** Label shown during multi-turn processing. */
	processingLabel?: (turnCount: number) => string;
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
 * import { myAdapter } from './adapter';
 *
 * function App() {
 *   return <Chat adapter={myAdapter} />;
 * }
 * ```
 */
export function Chat({
	adapter,
	contentFormat = 'markdown',
	renderContent,
	showTools,
	toolNames,
	placeholder,
	emptyState,
	initialMessages,
	initialSessionId,
	maxContinueTurns,
	onError,
	onMessage,
	className,
	processingLabel,
}: ChatProps) {
	const chat = useChat({
		adapter,
		initialMessages,
		initialSessionId,
		maxContinueTurns,
		onError,
		onMessage,
	});

	const displayTools = showTools ?? adapter.capabilities.tools;
	const baseClass = 'ec-chat';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	return (
		<ErrorBoundary onError={onError ? (err) => onError(err) : undefined}>
			<div className={classes}>
				<AvailabilityGate availability={chat.availability}>
					{adapter.capabilities.sessions && (
						<SessionSwitcher
							sessions={chat.sessions}
							activeSessionId={chat.sessionId ?? undefined}
							onSelect={chat.switchSession}
							onNew={chat.newSession}
							onDelete={adapter.deleteSession ? chat.deleteSession : undefined}
							loading={chat.sessionsLoading}
						/>
					)}

					<ChatMessages
						messages={chat.messages}
						contentFormat={contentFormat}
						renderContent={renderContent}
						showTools={displayTools}
						toolNames={toolNames}
						emptyState={emptyState}
					/>

					<TypingIndicator
						visible={chat.isLoading}
						label={
							chat.turnCount > 0
								? (processingLabel
									? processingLabel(chat.turnCount)
									: `Processing turn ${chat.turnCount}...`)
								: undefined
						}
					/>

					<ChatInput
						onSend={chat.sendMessage}
						disabled={chat.isLoading}
						placeholder={placeholder}
					/>
				</AvailabilityGate>
			</div>
		</ErrorBoundary>
	);
}
