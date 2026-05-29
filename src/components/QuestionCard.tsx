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
	/** Collapse choices after the user submits an answer. Defaults to true. */
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
	const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
	const [showChoices, setShowChoices] = useState(false);
	const baseClass = 'ec-chat-question';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const submitted = submittedAnswer !== null;
	const controlsDisabled = disabled || submitted;

	function submitAnswer(answer: string) {
		const nextAnswer = answer.trim();
		if (!nextAnswer || controlsDisabled) return;
		onSubmitAnswer(nextAnswer);
		if (autoHideOnSubmit) {
			setSubmittedAnswer(nextAnswer);
			setShowChoices(false);
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
		return (
			<div className={`${classes} ${baseClass}--submitted`}>
				<div className={`${baseClass}__submitted-header`}>
					<div className={`${baseClass}__prompt`}>{question}</div>
					{choices.length > 0 && (
						<button
							className={`${baseClass}__toggle`}
							type="button"
							onClick={() => setShowChoices((expanded) => !expanded)}
							aria-expanded={showChoices}
						>
							{showChoices ? 'Hide choices' : 'Show choices'}
						</button>
					)}
				</div>
				<div className={`${baseClass}__submitted-answer`}>
					<span className={`${baseClass}__submitted-check`} aria-hidden="true">✓</span>
					<span>{submittedAnswer}</span>
				</div>
				{showChoices && choices.length > 0 && (
					<div className={`${baseClass}__choices ${baseClass}__choices--readonly`} role="list" aria-label={question}>
						{choices.map((choice, index) => {
							const value = choice.message ?? choice.label;
							const selected = value === submittedAnswer;
							return (
								<div
									key={`${choice.label}-${index}`}
									className={`${baseClass}__choice ${baseClass}__choice--readonly${selected ? ` ${baseClass}__choice--selected` : ''}`}
									role="listitem"
								>
									<span className={`${baseClass}__choice-label`}>{choice.label}</span>
									{choice.description && (
										<span className={`${baseClass}__choice-description`}>{choice.description}</span>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		);
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
