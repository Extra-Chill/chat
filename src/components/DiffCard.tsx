import { useState, type ReactNode } from 'react';

/**
 * Diff data returned by a content-editing tool in preview mode.
 */
export interface DiffData {
	/** Server-assigned ID for resolving this diff (accept/reject). */
	diffId: string;
	/** The type of diff operation. */
	diffType: 'edit' | 'replace' | 'insert';
	/** Original content before the change. */
	originalContent: string;
	/** New content after the change. */
	replacementContent: string;
	/** Human-readable summary of what changed (optional). */
	summary?: string;
}

export interface DiffCardProps {
	/** The diff data to visualize. */
	diff: DiffData;
	/** Called when the user accepts the change. */
	onAccept?: (diffId: string) => void;
	/** Called when the user rejects the change. */
	onReject?: (diffId: string) => void;
	/** Whether the accept/reject action is in progress. */
	loading?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

type DiffCardStatus = 'pending' | 'accepted' | 'rejected';

/**
 * Portable diff visualization card.
 *
 * Renders a before/after comparison with word-level `<ins>` / `<del>` tags
 * and Accept / Reject buttons. Pure React — no Gutenberg or WordPress
 * dependencies. Works anywhere `@extrachill/chat` is consumed.
 *
 * @example
 * ```tsx
 * <DiffCard
 *   diff={{
 *     diffId: 'abc123',
 *     diffType: 'edit',
 *     originalContent: 'Hello world',
 *     replacementContent: 'Hello universe',
 *   }}
 *   onAccept={(id) => apiFetch({ path: `/resolve/${id}`, method: 'POST', data: { action: 'accept' } })}
 *   onReject={(id) => apiFetch({ path: `/resolve/${id}`, method: 'POST', data: { action: 'reject' } })}
 * />
 * ```
 */
export function DiffCard({
	diff,
	onAccept,
	onReject,
	loading = false,
	className,
}: DiffCardProps) {
	const [status, setStatus] = useState<DiffCardStatus>('pending');

	const baseClass = 'ec-chat-diff';
	const classes = [
		baseClass,
		status !== 'pending' ? `${baseClass}--${status}` : '',
		className,
	].filter(Boolean).join(' ');

	const handleAccept = () => {
		setStatus('accepted');
		onAccept?.(diff.diffId);
	};

	const handleReject = () => {
		setStatus('rejected');
		onReject?.(diff.diffId);
	};

	const diffHtml = renderDiff(diff);

	return (
		<div className={classes}>
			<div className={`${baseClass}__header`}>
				<span className={`${baseClass}__icon`}>
					{status === 'accepted' ? '✓' : status === 'rejected' ? '✗' : '⟳'}
				</span>
				<span className={`${baseClass}__label`}>
					{diff.summary ?? formatDiffLabel(diff.diffType)}
				</span>
				{status !== 'pending' && (
					<span className={`${baseClass}__status`}>
						{status === 'accepted' ? 'Applied' : 'Rejected'}
					</span>
				)}
			</div>

			<div
				className={`${baseClass}__content`}
				dangerouslySetInnerHTML={{ __html: diffHtml }}
			/>

			{status === 'pending' && (
				<div className={`${baseClass}__actions`}>
					<button
						type="button"
						className={`${baseClass}__accept`}
						onClick={handleAccept}
						disabled={loading}
					>
						Accept
					</button>
					<button
						type="button"
						className={`${baseClass}__reject`}
						onClick={handleReject}
						disabled={loading}
					>
						Reject
					</button>
				</div>
			)}
		</div>
	);
}

/**
 * Render diff HTML based on the diff type.
 *
 * For 'edit' diffs: word-level comparison between original and replacement.
 * For 'replace' diffs: word-level comparison between original and replacement.
 * For 'insert' diffs: everything is new (all `<ins>`).
 */
function renderDiff(diff: DiffData): string {
	const { diffType, originalContent, replacementContent } = diff;

	if (diffType === 'insert') {
		return `<ins class="ec-chat-diff__added">${escapeHtml(replacementContent)}</ins>`;
	}

	// Both 'edit' and 'replace' get word-level diff
	return createWordLevelDiff(originalContent, replacementContent);
}

/**
 * Create a word-level diff between two strings.
 *
 * Splits both strings into words, runs a longest-common-subsequence (LCS)
 * alignment, and wraps removed words in `<del>` and added words in `<ins>`.
 * Consecutive unchanged words are emitted as-is.
 */
function createWordLevelDiff(oldText: string, newText: string): string {
	if (oldText === newText) {
		return escapeHtml(newText);
	}

	const oldWords = tokenize(oldText);
	const newWords = tokenize(newText);

	// LCS table
	const m = oldWords.length;
	const n = newWords.length;
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (oldWords[i - 1] === newWords[j - 1]) {
				dp[i][j] = dp[i - 1][j - 1] + 1;
			} else {
				dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
			}
		}
	}

	// Backtrack to produce diff operations
	const ops: Array<{ type: 'keep' | 'del' | 'ins'; text: string }> = [];
	let i = m;
	let j = n;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
			ops.unshift({ type: 'keep', text: oldWords[i - 1] });
			i--;
			j--;
		} else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
			ops.unshift({ type: 'ins', text: newWords[j - 1] });
			j--;
		} else {
			ops.unshift({ type: 'del', text: oldWords[i - 1] });
			i--;
		}
	}

	// Merge consecutive same-type ops into spans
	let html = '';
	let currentType: 'keep' | 'del' | 'ins' | null = null;
	let buffer: string[] = [];

	const flush = () => {
		if (buffer.length === 0) return;
		const text = buffer.join(' ');
		if (currentType === 'del') {
			html += `<del class="ec-chat-diff__removed">${escapeHtml(text)}</del>`;
		} else if (currentType === 'ins') {
			html += `<ins class="ec-chat-diff__added">${escapeHtml(text)}</ins>`;
		} else {
			html += escapeHtml(text);
		}
		buffer = [];
	};

	for (const op of ops) {
		if (op.type !== currentType) {
			flush();
			currentType = op.type;
		}
		buffer.push(op.text);
	}
	flush();

	return html;
}

/**
 * Tokenize text into words, preserving whitespace as separate tokens
 * so the diff output is readable.
 */
function tokenize(text: string): string[] {
	return text.split(/(\s+)/).filter(Boolean);
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Human-readable label for a diff type.
 */
function formatDiffLabel(diffType: DiffData['diffType']): string {
	switch (diffType) {
		case 'edit':
			return 'Content edit';
		case 'replace':
			return 'Content replacement';
		case 'insert':
			return 'New content';
	}
}
