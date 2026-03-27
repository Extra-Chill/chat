import { useState, useEffect, useRef } from 'react';

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
 * The dot animation is pure CSS — no JS timers.
 *
 * When `label` changes, the text crossfades out/in via CSS transition.
 */
export function TypingIndicator({
	visible,
	label,
	className,
}: TypingIndicatorProps) {
	// Track displayed label separately so we can fade out/in on change.
	const [displayLabel, setDisplayLabel] = useState(label);
	const [fading, setFading] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

	useEffect(() => {
		if (label === displayLabel) return;

		// Start fade-out, then swap text and fade-in.
		setFading(true);

		clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			setDisplayLabel(label);
			setFading(false);
		}, 150); // matches CSS transition duration

		return () => clearTimeout(timeoutRef.current);
	}, [label, displayLabel]);

	// Reset when indicator hides.
	useEffect(() => {
		if (!visible) {
			setDisplayLabel(undefined);
			setFading(false);
		}
	}, [visible]);

	if (!visible) return null;

	const baseClass = 'ec-chat-typing';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const labelClasses = [
		`${baseClass}__label`,
		fading ? `${baseClass}__label--fading` : '',
	].filter(Boolean).join(' ');

	return (
		<div className={classes} role="status" aria-label="Assistant is typing">
			<div className={`${baseClass}__dots`}>
				<span className={`${baseClass}__dot`} />
				<span className={`${baseClass}__dot`} />
				<span className={`${baseClass}__dot`} />
			</div>
			{displayLabel && <span className={labelClasses}>{displayLabel}</span>}
		</div>
	);
}
