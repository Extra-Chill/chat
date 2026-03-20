export interface TypingIndicatorProps {
	/** Whether the indicator is visible. */
	visible: boolean;
	/** Optional label text. Defaults to none (dots only). */
	label?: string;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Animated typing indicator with three bouncing dots.
 *
 * Renders as an assistant-style message bubble.
 * The animation is pure CSS — no JS timers.
 */
export function TypingIndicator({
	visible,
	label,
	className,
}: TypingIndicatorProps) {
	if (!visible) return null;

	const baseClass = 'ec-chat-typing';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	return (
		<div className={classes} role="status" aria-label="Assistant is typing">
			<div className={`${baseClass}__dots`}>
				<span className={`${baseClass}__dot`} />
				<span className={`${baseClass}__dot`} />
				<span className={`${baseClass}__dot`} />
			</div>
			{label && <span className={`${baseClass}__label`}>{label}</span>}
		</div>
	);
}
