import { useState, useRef, useCallback, type KeyboardEvent, type FormEvent, type DragEvent, type ClipboardEvent } from 'react';

export interface ChatInputProps {
	/** Called when the user submits a message (with optional file attachments). */
	onSend: (content: string, files?: File[]) => void;
	/** Whether input is disabled (e.g. while waiting for response). */
	disabled?: boolean;
	/** Placeholder text. Defaults to 'Type a message...'. */
	placeholder?: string;
	/** Maximum number of rows the textarea auto-grows to. Defaults to 6. */
	maxRows?: number;
	/** Accepted file types for the file picker. Defaults to 'image/*,video/*'. */
	accept?: string;
	/** Maximum number of files per message. Defaults to 5. */
	maxFiles?: number;
	/** Whether to show the attachment button. Defaults to true. */
	allowAttachments?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Chat input with auto-growing textarea, keyboard shortcuts, and file attachments.
 *
 * - Enter sends the message
 * - Shift+Enter adds a newline
 * - Textarea auto-grows up to `maxRows`
 * - File attachment via button, drag-and-drop, or clipboard paste
 */
export function ChatInput({
	onSend,
	disabled = false,
	placeholder = 'Type a message...',
	maxRows = 6,
	accept = 'image/*,video/*',
	maxFiles = 5,
	allowAttachments = true,
	className,
}: ChatInputProps) {
	const [value, setValue] = useState('');
	const [files, setFiles] = useState<File[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const cooldownRef = useRef(false);

	const resize = useCallback(() => {
		const el = textareaRef.current;
		if (!el) return;
		el.style.height = 'auto';
		const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
		const maxHeight = lineHeight * maxRows;
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}, [maxRows]);

	const addFiles = useCallback((newFiles: FileList | File[]) => {
		const fileArray = Array.from(newFiles);
		setFiles((prev) => {
			const combined = [...prev, ...fileArray];
			return combined.slice(0, maxFiles);
		});
	}, [maxFiles]);

	const removeFile = useCallback((index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
	}, []);

	const handleSubmit = useCallback((e?: FormEvent) => {
		e?.preventDefault();
		const trimmed = value.trim();
		if ((!trimmed && files.length === 0) || disabled || cooldownRef.current) return;

		cooldownRef.current = true;
		setTimeout(() => { cooldownRef.current = false; }, 300);

		onSend(trimmed, files.length > 0 ? files : undefined);
		setValue('');
		setFiles([]);

		requestAnimationFrame(() => {
			const el = textareaRef.current;
			if (el) el.style.height = 'auto';
		});
	}, [value, files, disabled, onSend]);

	const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	}, [handleSubmit]);

	const handleDragOver = useCallback((e: DragEvent) => {
		e.preventDefault();
		if (allowAttachments) setIsDragging(true);
	}, [allowAttachments]);

	const handleDragLeave = useCallback((e: DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	}, []);

	const handleDrop = useCallback((e: DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		if (!allowAttachments || !e.dataTransfer.files.length) return;
		addFiles(e.dataTransfer.files);
	}, [allowAttachments, addFiles]);

	const handlePaste = useCallback((e: ClipboardEvent) => {
		if (!allowAttachments) return;
		const pastedFiles = Array.from(e.clipboardData.items)
			.filter((item) => item.kind === 'file')
			.map((item) => item.getAsFile())
			.filter((f): f is File => f !== null);

		if (pastedFiles.length > 0) {
			addFiles(pastedFiles);
		}
	}, [allowAttachments, addFiles]);

	const baseClass = 'ec-chat-input';
	const classes = [
		baseClass,
		isDragging ? `${baseClass}--dragging` : '',
		className,
	].filter(Boolean).join(' ');

	return (
		<form
			className={classes}
			onSubmit={handleSubmit}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{files.length > 0 && (
				<div className={`${baseClass}__attachments`}>
					{files.map((file, i) => (
						<FilePreview key={`${file.name}-${i}`} file={file} onRemove={() => removeFile(i)} />
					))}
				</div>
			)}
			<div className={`${baseClass}__row`}>
				{allowAttachments && (
					<>
						<input
							ref={fileInputRef}
							type="file"
							accept={accept}
							multiple
							className={`${baseClass}__file-input`}
							onChange={(e) => {
								if (e.target.files) addFiles(e.target.files);
								e.target.value = '';
							}}
							tabIndex={-1}
							aria-hidden="true"
						/>
						<button
							type="button"
							className={`${baseClass}__attach`}
							onClick={() => fileInputRef.current?.click()}
							disabled={disabled}
							aria-label="Attach file"
							title="Attach file"
						>
							<AttachIcon />
						</button>
					</>
				)}
				<textarea
					ref={textareaRef}
					className={`${baseClass}__textarea`}
					value={value}
					onChange={(e) => { setValue(e.target.value); resize(); }}
					onKeyDown={handleKeyDown}
					onPaste={handlePaste}
					placeholder={placeholder}
					disabled={disabled}
					rows={1}
					aria-label={placeholder}
				/>
				<button
					className={`${baseClass}__send`}
					type="submit"
					disabled={disabled || (!value.trim() && files.length === 0)}
					aria-label="Send message"
				>
					<SendIcon />
				</button>
			</div>
		</form>
	);
}

/* ---- File Preview ---- */

function FilePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
	const isImage = file.type.startsWith('image/');
	const preview = isImage ? URL.createObjectURL(file) : null;

	return (
		<div className="ec-chat-input__preview">
			{preview ? (
				<img src={preview} alt={file.name} className="ec-chat-input__preview-image" />
			) : (
				<span className="ec-chat-input__preview-name">{file.name}</span>
			)}
			<button
				type="button"
				className="ec-chat-input__preview-remove"
				onClick={onRemove}
				aria-label={`Remove ${file.name}`}
			>
				&times;
			</button>
		</div>
	);
}

/* ---- Icons ---- */

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

function AttachIcon() {
	return (
		<svg
			className="ec-chat-input__attach-icon"
			viewBox="0 0 24 24"
			width="20"
			height="20"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
		</svg>
	);
}
