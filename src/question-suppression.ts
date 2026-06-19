import type { MessageTimelineItem } from './tool-timeline.ts';
import type { ToolGroup } from './tool-timeline.ts';
import type { QuestionToolPayload } from './tool-renderers.tsx';

/**
 * Deterministic suppression of assistant prose that merely restates a question
 * already rendered as an interactive card.
 *
 * Background (#65): when a tool group renders a `QuestionCard` (a structured
 * `{question, choices}` payload), chatty models often ALSO emit a separate
 * assistant `text` turn that restates the very same choices as a markdown
 * bullet list. Both surfaces render stacked; users answer the prose list
 * instead of clicking the card. The card is the canonical, sole rendering of a
 * choice set — the prose duplicate is the bug.
 *
 * This module detects, structurally and conservatively, when an assistant text
 * turn adjacent to a question card is a redundant restatement of that card's
 * choices, so the renderer can drop the prose and keep only the card.
 *
 * It is deliberately layer-pure: it keys off the rendered-question *shape*
 * (`{question, choices}`), never a tool name, so any candidate-producing tool
 * benefits (consistent with #61). No vendor, plugin, or tool names appear here.
 */

/** Strip a leading markdown list/quote marker from a single line. */
function stripListMarker(line: string): string {
	return line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '').trim();
}

/** True when a line begins with a markdown bullet or ordered-list marker. */
function isListLine(line: string): boolean {
	return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
}

/**
 * Normalize text for label comparison: lowercased, markdown emphasis and
 * surrounding punctuation removed, whitespace collapsed. This lets a card
 * choice label like `extrachill-blog (main)` match a prose bullet rendered as
 * `**extrachill-blog (main)** (homepage rendering/blocks)`.
 */
function normalizeForMatch(value: string): string {
	return value
		.toLowerCase()
		// Drop markdown emphasis markers (**bold**, *italic*, `code`, _under_).
		.replace(/[*_`]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * True when `haystack` contains `needle` as a token-boundary substring after
 * normalization. Empty needles never match.
 */
function containsLabel(haystack: string, needle: string): boolean {
	const normalizedNeedle = normalizeForMatch(needle);
	if (!normalizedNeedle) {
		return false;
	}

	return normalizeForMatch(haystack).includes(normalizedNeedle);
}

export interface QuestionRestatementOptions {
	/**
	 * Minimum fraction of a card's choice labels that must appear in the prose,
	 * as a markdown list, before the prose is treated as a redundant
	 * restatement. Defaults to 1 (every labeled choice must be present) to keep
	 * suppression conservative and avoid false positives.
	 */
	minChoiceCoverage?: number;
}

/**
 * Decide whether an assistant text turn is a redundant restatement of a
 * question card's choices.
 *
 * The check is intentionally structural and conservative — it suppresses only
 * when the prose is clearly the same choice set restated, never arbitrary
 * assistant prose that happens to follow a card:
 *
 * - When the card has choices: the text must contain a markdown bullet/ordered
 *   list, and (a configurable fraction of) the choice labels must each appear
 *   inside those list lines. Legitimate follow-up prose that is not a list, or
 *   that omits the choices, is left untouched.
 * - When the card has no choices (a bare question): the text is suppressed only
 *   when, with list markers and the question itself removed, essentially
 *   nothing meaningful remains — i.e. the turn is just the question echoed.
 */
export function isRedundantQuestionRestatement(
	content: string,
	payload: QuestionToolPayload,
	options: QuestionRestatementOptions = {},
): boolean {
	const text = content.trim();
	if (!text) {
		return false;
	}

	const lines = text.split(/\r?\n/);
	const listLines = lines.filter(isListLine);
	const labels = payload.choices
		.map((choice) => choice.label.trim())
		.filter((label) => label.length > 0);

	if (labels.length > 0) {
		// A choice set restated as prose is, by definition, a list. Require an
		// actual markdown list so flowing prose that merely name-drops an option
		// is never suppressed.
		if (listLines.length === 0) {
			return false;
		}

		const listBlock = listLines.map(stripListMarker).join('\n');
		const matchedLabels = labels.filter((label) => containsLabel(listBlock, label));
		const coverage = matchedLabels.length / labels.length;
		const minChoiceCoverage = options.minChoiceCoverage ?? 1;

		return coverage >= minChoiceCoverage;
	}

	// No choices: a bare question. Suppress only a turn that is essentially just
	// the question echoed (optionally as a one-line list), leaving no other
	// meaningful content.
	const question = payload.question.trim();
	if (!question) {
		return false;
	}

	const withoutQuestion = normalizeForMatch(text).replace(normalizeForMatch(question), '');
	const residue = withoutQuestion.replace(/[\s.,:;!?-]+/g, '');
	const echoesQuestion = normalizeForMatch(text).includes(normalizeForMatch(question));

	return echoesQuestion && residue.length === 0;
}

/**
 * Given an ordered timeline and a question-payload parser, return the set of
 * assistant `message` item IDs that should be suppressed because they
 * redundantly restate the choices of an immediately-adjacent question card.
 *
 * "Adjacent" means the assistant text turn sits directly before or directly
 * after the question tool-group in the rendered timeline (ignoring nothing in
 * between — the turns must be neighbors). Each prose turn is suppressed at most
 * once, and only against a directly-neighboring card.
 */
export function collectSuppressedQuestionRestatementIds(
	items: MessageTimelineItem[],
	parseQuestion: (group: ToolGroup) => QuestionToolPayload | null,
	options: QuestionRestatementOptions = {},
): Set<string> {
	const suppressed = new Set<string>();

	for (let index = 0; index < items.length; index += 1) {
		const item = items[index];
		if (item.type !== 'tool-group') {
			continue;
		}

		const payload = parseQuestion(item.group);
		if (!payload) {
			continue;
		}

		// Check both neighbors: a restatement may render just before or just
		// after the card depending on backend message ordering.
		for (const neighbor of [items[index - 1], items[index + 1]]) {
			if (!neighbor || neighbor.type !== 'message') {
				continue;
			}

			const message = neighbor.message;
			if (message.role !== 'assistant' || suppressed.has(message.id)) {
				continue;
			}

			if (isRedundantQuestionRestatement(message.content, payload, options)) {
				suppressed.add(message.id);
			}
		}
	}

	return suppressed;
}
