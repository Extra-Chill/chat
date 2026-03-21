import { type ReactNode, lazy, Suspense } from 'react';
import type { ChatMessage as ChatMessageType, ContentFormat, MediaAttachment } from '../types/index.ts';
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
 * Media attachments render inline below the text content.
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

	const hasText = message.content.trim().length > 0;
	const hasAttachments = message.attachments && message.attachments.length > 0;

	return (
		<div className={classes} data-message-id={message.id}>
			<div className={`${baseClass}__bubble`}>
				{hasText && (
					renderContent
						? renderContent(message.content, message.role)
						: <DefaultContent content={message.content} format={contentFormat} />
				)}
				{hasAttachments && (
					<MessageAttachments attachments={message.attachments!} />
				)}
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

/* ---- Media Attachments ---- */

function MessageAttachments({ attachments }: { attachments: MediaAttachment[] }) {
	const images = attachments.filter((a) => a.type === 'image');
	const videos = attachments.filter((a) => a.type === 'video');
	const files = attachments.filter((a) => a.type === 'file');

	return (
		<div className="ec-chat-message__attachments">
			{images.length > 0 && (
				<div className="ec-chat-message__images">
					{images.map((img, i) => (
						<a
							key={i}
							href={img.url}
							target="_blank"
							rel="noopener noreferrer"
							className="ec-chat-message__image-link"
						>
							<img
								src={img.thumbnailUrl ?? img.url}
								alt={img.alt ?? img.filename ?? 'Image attachment'}
								className="ec-chat-message__image"
								loading="lazy"
							/>
						</a>
					))}
				</div>
			)}
			{videos.map((vid, i) => (
				<video
					key={i}
					src={vid.url}
					controls
					className="ec-chat-message__video"
					preload="metadata"
				>
					<track kind="captions" />
				</video>
			))}
			{files.map((file, i) => (
				<a
					key={i}
					href={file.url}
					download={file.filename}
					className="ec-chat-message__file"
					target="_blank"
					rel="noopener noreferrer"
				>
					<FileIcon />
					<span className="ec-chat-message__file-name">
						{file.filename ?? 'Download file'}
					</span>
					{file.size != null && (
						<span className="ec-chat-message__file-size">
							{formatFileSize(file.size)}
						</span>
					)}
				</a>
			))}
		</div>
	);
}

function FileIcon() {
	return (
		<svg
			className="ec-chat-message__file-icon"
			viewBox="0 0 24 24"
			width="16"
			height="16"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
		</svg>
	);
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
