import { type ReactNode, useMemo } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat } from '../types/index.ts';
import { markdownToHtml } from '../markdown.ts';

export interface ChatMessageProps {
	/** The message to render. */
	message: ChatMessageType;
	/** How to render message content. Defaults to 'markdown'. */
	contentFormat?: ContentFormat;
	/**
	 * Custom content renderer. When provided, overrides contentFormat.
	 * Use this to plug in your own markdown renderer (react-markdown, etc.).
	 */
	renderContent?: (content: string, role: ChatMessageType['role']) => ReactNode;
	/** Additional CSS class name on the outer wrapper. */
	className?: string;
}

/**
 * Renders a single chat message bubble.
 *
 * User messages align right, assistant messages align left.
 * Content rendering is pluggable via `renderContent` or `contentFormat`.
 */
export function ChatMessage({
	message,
	contentFormat = 'markdown',
	renderContent,
	className,
}: ChatMessageProps) {
	const isUser = message.role === 'user';
	const baseClass = 'ec-chat-message';
	const roleClass = isUser ? `${baseClass}--user` : `${baseClass}--assistant`;
	const classes = [baseClass, roleClass, className].filter(Boolean).join(' ');

	return (
		<div className={classes} data-message-id={message.id}>
			<div className={`${baseClass}__bubble`}>
				{renderContent
					? renderContent(message.content, message.role)
					: <DefaultContent content={message.content} format={contentFormat} />
				}
			</div>
			{message.timestamp && (
				<time
					className={`${baseClass}__timestamp`}
					dateTime={message.timestamp}
					title={new Date(message.timestamp).toLocaleString()}
				>
					{formatTime(message.timestamp)}
				</time>
			)}
		</div>
	);
}

interface DefaultContentProps {
	content: string;
	format: ContentFormat;
}

function DefaultContent({ content, format }: DefaultContentProps) {
	const html = useMemo(() => {
		if (format === 'html') return content;
		if (format === 'markdown') return markdownToHtml(content);
		return null;
	}, [content, format]);

	if (html !== null) {
		return <div dangerouslySetInnerHTML={{ __html: html }} />;
	}

	// Plain text — split on double newlines for paragraphs.
	return (
		<>
			{content.split('\n\n').map((paragraph, i) => (
				<p key={i}>{paragraph}</p>
			))}
		</>
	);
}

function formatTime(iso: string): string {
	try {
		const date = new Date(iso);
		return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	} catch {
		return '';
	}
}
