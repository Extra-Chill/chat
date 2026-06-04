import type { ReactNode } from 'react';
import type { ChatCitation } from '../types/index.ts';

export interface CitationBadgeProps {
	/** Citation to render. */
	citation: ChatCitation;
	/** One-based fallback index used when citation.index is omitted. */
	index?: number;
	/** Additional CSS class name on the badge. */
	className?: string;
}

export interface CitationsListProps {
	/** Citations to render. */
	citations: ChatCitation[];
	/** Accessible label for the citation list. */
	label?: string;
	/** Optional custom citation renderer. */
	renderCitation?: (citation: ChatCitation, index: number) => ReactNode;
	/** Additional CSS class name on the outer wrapper. */
	className?: string;
}

export function CitationsList({
	citations,
	label = 'Sources',
	renderCitation,
	className,
}: CitationsListProps) {
	if (citations.length === 0) {
		return null;
	}

	const baseClass = 'ec-chat-citations';
	const classes = [baseClass, className].filter(Boolean).join(' ');

	return (
		<section className={classes} aria-label={label}>
			<div className={`${baseClass}__label`}>{label}</div>
			<ol className={`${baseClass}__list`}>
				{citations.map((citation, index) => (
					<li className={`${baseClass}__item`} key={citation.id ?? citation.source?.id ?? index}>
						{renderCitation
							? renderCitation(citation, index + 1)
							: <CitationBadge citation={citation} index={index + 1} />}
					</li>
				))}
			</ol>
		</section>
	);
}

export function CitationBadge({ citation, index, className }: CitationBadgeProps) {
	const baseClass = 'ec-chat-citation';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const href = citation.url ?? citation.source?.url;
	const label = citation.source?.title ?? citation.source?.label ?? citation.source?.id ?? href ?? 'Source';
	const number = citation.index ?? index;
	const content = (
		<>
			{number != null && <span className={`${baseClass}__index`}>{number}</span>}
			<span className={`${baseClass}__label`}>{label}</span>
			{citation.snippet && <span className={`${baseClass}__snippet`}>{citation.snippet}</span>}
		</>
	);

	if (href) {
		return (
			<a className={classes} href={href} target="_blank" rel="noopener noreferrer">
				{content}
			</a>
		);
	}

	return <span className={classes}>{content}</span>;
}
