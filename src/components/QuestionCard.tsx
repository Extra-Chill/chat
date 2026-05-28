import { useState, type FormEvent } from 'react';

export interface QuestionChoice {
	/** Short visible choice label. */
	label: string;
	/** Message sent when selected. Defaults to the label. */
	message?: string;
	/** Optional supporting text shown under the label. */
	description?: string;
}

export interface QuestionCardProps {
	/** Question to ask the user. */
	question: string;
	/** Model-proposed choices. */
	choices?: QuestionChoice[];
	/** Whether the user may type a custom answer. Defaults to true. */
	allowFreeform?: boolean;
	/** Label for the freeform answer input. */
	freeformLabel?: string;
	/** Placeholder for the freeform answer input. */
	freeformPlaceholder?: string;
	/** Called with the selected or typed answer. */
	onSubmitAnswer: (answer: string) => void;
	/** Whether controls are disabled. */
	disabled?: boolean;
	/** Hide the card after the user submits an answer. Defaults to true. */
	autoHideOnSubmit?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Renders a structured model-proposed question with selectable choices and
 * an optional custom-answer input.
 */
export function QuestionCard({
	question,
	choices = [],
	allowFreeform = true,
	freeformLabel = 'Type your own answer',
	freeformPlaceholder = 'Type your answer...',
	onSubmitAnswer,
	disabled = false,
	autoHideOnSubmit = true,
	className,
}: QuestionCardProps) {
	const [freeformAnswer, setFreeformAnswer] = useState('');
	const [submitted, setSubmitted] = useState(false);
	const baseClass = 'ec-chat-question';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const controlsDisabled = disabled || submitted;

	function submitAnswer(answer: string) {
		if (!answer.trim() || controlsDisabled) return;
		onSubmitAnswer(answer);
		if (autoHideOnSubmit) {
			setSubmitted(true);
		}
	}

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		const answer = freeformAnswer.trim();
		if (!answer || controlsDisabled) return;
		submitAnswer(answer);
		setFreeformAnswer('');
	}

	if (submitted && autoHideOnSubmit) {
		return null;
	}

	return (
		<div className={classes}>
			<div className={`${baseClass}__prompt`}>{question}</div>
			{choices.length > 0 && (
				<div className={`${baseClass}__choices`} role="group" aria-label={question}>
					{choices.map((choice, index) => (
						<button
							key={`${choice.label}-${index}`}
							className={`${baseClass}__choice`}
							type="button"
							onClick={() => submitAnswer(choice.message ?? choice.label)}
							disabled={controlsDisabled}
						>
							<span className={`${baseClass}__choice-label`}>{choice.label}</span>
							{choice.description && (
								<span className={`${baseClass}__choice-description`}>{choice.description}</span>
							)}
						</button>
					))}
				</div>
			)}
			{allowFreeform && (
				<form className={`${baseClass}__freeform`} onSubmit={handleSubmit}>
					<label className={`${baseClass}__freeform-label`}>
						{freeformLabel}
						<input
							className={`${baseClass}__freeform-input`}
							type="text"
							value={freeformAnswer}
							onChange={(event) => setFreeformAnswer(event.target.value)}
							placeholder={freeformPlaceholder}
							disabled={controlsDisabled}
						/>
					</label>
					<button className={`${baseClass}__freeform-submit`} type="submit" disabled={controlsDisabled || !freeformAnswer.trim()}>
						Send
					</button>
				</form>
			)}
		</div>
	);
}
