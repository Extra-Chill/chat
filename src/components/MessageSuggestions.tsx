export interface ChatMessageSuggestion {
	/** Short visible suggestion label. */
	label: string;
	/** Message sent when selected. Defaults to the label. */
	message?: string;
	/** Optional supporting text shown under the label. */
	description?: string;
}

export interface MessageSuggestionsProps {
	/** Suggestions to offer. */
	suggestions: ChatMessageSuggestion[];
	/** Called when a suggestion is selected. */
	onSelect: (suggestion: ChatMessageSuggestion) => void;
	/** Accessible label for the suggestion group. */
	label?: string;
	/** Whether suggestion buttons are disabled. */
	disabled?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Optional prompt starters for fresh conversations.
 */
export function MessageSuggestions({
	suggestions,
	onSelect,
	label = 'Suggested messages',
	disabled = false,
	className,
}: MessageSuggestionsProps) {
	if (suggestions.length === 0) {
		return null;
	}

	const baseClass = 'ec-chat-suggestions';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	return (
		<div className={classes} role="group" aria-label={label}>
			{suggestions.map((suggestion, index) => (
				<button
					key={`${suggestion.label}-${index}`}
					className={`${baseClass}__item`}
					type="button"
					onClick={() => onSelect(suggestion)}
					disabled={disabled}
				>
					<span className={`${baseClass}__label`}>{suggestion.label}</span>
					{suggestion.description && (
						<span className={`${baseClass}__description`}>{suggestion.description}</span>
					)}
				</button>
			))}
		</div>
	);
}
