import { type ReactNode, lazy, Suspense } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat } from '../types/index.ts';
import { markdownToHtml } from '../markdown.ts';

const ReactMarkdown = lazy(() => import('react-markdown'));

export interface ChatMessageProps {
	/** The message to render. */
	message: ChatMessageType;
	/** How to render message content. Defaults to 'markdown'. */
	contentFormat?: ContentFormat;
	/**
	 * Custom content renderer. When provided, overrides contentFormat.
	 */
	renderContent?: (content: string, role: ChatMessageType['role']) => ReactNode;
	/** Additional CSS class name on the outer wrapper. */
	className?: string;
}

/**
 * Renders a single chat message bubble.
 *
 * User messages align right, assistant messages align left.
 * Markdown content is rendered via react-markdown (lazy-loaded).
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

/**
 * Markdown rendered via lazy-loaded react-markdown.
 * Falls back to the built-in lightweight parser while loading.
 */
function MarkdownContent({ content }: { content: string }) {
	return (
		<Suspense
			fallback={
				<div dangerouslySetInnerHTML={{ __html: markdownToHtml(content) }} />
			}
		>
			<ReactMarkdown>{content}</ReactMarkdown>
		</Suspense>
	);
}

function DefaultContent({ content, format }: DefaultContentProps) {
	if (format === 'html') {
		return <div dangerouslySetInnerHTML={{ __html: content }} />;
	}

	if (format === 'markdown') {
		return <MarkdownContent content={content} />;
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
