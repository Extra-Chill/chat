import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent } from 'react';

export interface ChatInputProps {
	/** Called when the user submits a message. */
	onSend: (content: string) => void;
	/** Whether input is disabled (e.g. while waiting for response). */
	disabled?: boolean;
	/** Placeholder text. Defaults to 'Type a message...'. */
	placeholder?: string;
	/** Maximum number of rows the textarea auto-grows to. Defaults to 6. */
	maxRows?: number;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Chat input with auto-growing textarea and keyboard shortcuts.
 *
 * - Enter sends the message
 * - Shift+Enter adds a newline
 * - Textarea auto-grows up to `maxRows`
 */
export function ChatInput({
	onSend,
	disabled = false,
	placeholder = 'Type a message...',
	maxRows = 6,
	className,
}: ChatInputProps) {
	const [value, setValue] = useState('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const cooldownRef = useRef(false);

	const resize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
		const maxHeight = lineHeight * maxRows;
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}, [maxRows]);

	const handleSubmit = useCallback((e?: FormEvent) => {
		e?.preventDefault();
		const trimmed = value.trim();
		if (!trimmed || disabled || cooldownRef.current) return;

		// Debounce to prevent double-submit
		cooldownRef.current = true;
		setTimeout(() => { cooldownRef.current = false; }, 300);

		onSend(trimmed);
		setValue('');

		// Reset textarea height after clearing
		requestAnimationFrame(() => {
			const el = textareaRef.current;
			if (el) el.style.height = 'auto';
		});
	}, [value, disabled, onSend]);

	const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}, [handleSubmit]);

	const baseClass = 'ec-chat-input';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	return (
		<form className={classes} onSubmit={handleSubmit}>
			<textarea
				ref={textareaRef}
				className={`${baseClass}__textarea`}
				value={value}
				onChange={(e) => { setValue(e.target.value); resize(); }}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				disabled={disabled}
				rows={1}
				aria-label={placeholder}
			/>
			<button
				className={`${baseClass}__send`}
				type="submit"
				disabled={disabled || !value.trim()}
				aria-label="Send message"
			>
				<SendIcon />
			</button>
		</form>
	);
}

function SendIcon() {
	return (
		<svg
			className="ec-chat-input__send-icon"
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<line x1="22" y1="2" x2="11" y2="13" />
			<polygon points="22 2 15 22 11 13 2 9 22 2" />
		</svg>
	);
}
