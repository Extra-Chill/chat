import { useState } from 'react';

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
	/** Called with the selected answer. */
	onSubmitAnswer: (answer: string) => void;
	/**
	 * Whether controls are disabled. This is a hint that a request is in
	 * flight; it never permanently locks a question that is still awaiting the
	 * user's answer. Once the user has submitted, the card locks itself.
	 */
	disabled?: boolean;
	/** Collapse choices after the user submits an answer. Defaults to true. */
	autoHideOnSubmit?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Renders a structured model-proposed question with selectable choices.
 *
 * A question that is awaiting the user's answer is always interactive: the
 * card only locks its choice buttons once the user has actually submitted an
 * answer. This prevents a never-resolving loading state upstream from leaving
 * the question permanently unanswerable. Users who need a different answer use
 * the main chat input, so there is no freeform field here.
 */
export function QuestionCard({
	question,
	choices = [],
	onSubmitAnswer,
	disabled = false,
	autoHideOnSubmit = true,
	className,
}: QuestionCardProps) {
	const [submittedAnswer, setSubmittedAnswer] = useState<string | null>(null);
	const [showChoices, setShowChoices] = useState(false);
	const baseClass = 'ec-chat-question';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const submitted = submittedAnswer !== null;
	// Only a submitted answer fully locks the card. `disabled` (e.g. a request
	// in flight) suppresses interaction while busy but must never strand a
	// still-unanswered question, so it is intentionally NOT folded into the
	// permanent lock state.
	const controlsDisabled = submitted || disabled;

	function submitAnswer(answer: string) {
		const nextAnswer = answer.trim();
		if (!nextAnswer || submitted) return;
		onSubmitAnswer(nextAnswer);
		if (autoHideOnSubmit) {
			setSubmittedAnswer(nextAnswer);
			setShowChoices(false);
		}
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
		</div>
	);
}
