import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChatMessages } from '../dist/components/ChatMessages.js';
import { createQuestionToolRenderer } from '../dist/tool-renderers.js';
import { isRedundantQuestionRestatement } from '../dist/question-suppression.js';

// A present_question tool call + result carrying a {question, choices} payload.
const questionToolGroup = (question, choices) => [
	{
		id: 'assistant-tool',
		role: 'assistant',
		content: '',
		timestamp: '2026-01-01T00:00:00.000Z',
		toolCalls: [{ id: 'call-1', name: 'present_question', parameters: {} }],
	},
	{
		id: 'result-1',
		role: 'tool_result',
		content: JSON.stringify({ result: { question, choices } }),
		timestamp: '2026-01-01T00:00:01.000Z',
		toolResult: { toolName: 'present_question', success: true, toolCallId: 'call-1' },
	},
];

const proseTurn = (id, content) => ({
	id,
	role: 'assistant',
	content,
	timestamp: '2026-01-01T00:00:02.000Z',
});

const renderMarkup = (messages) =>
	renderToStaticMarkup(
		createElement(ChatMessages, {
			showTools: true,
			shapeRenderers: [createQuestionToolRenderer()],
			messages,
		}),
	);

const buttonCount = (markup) => (markup.match(/<button\b/g) ?? []).length;

// ---------------------------------------------------------------------------
// Render-side behavior (#65 acceptance criteria)
// ---------------------------------------------------------------------------

test('present_question card + prose restatement of the SAME choices => only the card renders', () => {
	// The exact repro shape from #65: a card, then an assistant text turn that
	// restates the same choices as a markdown bullet list.
	const messages = [
		...questionToolGroup('Which repo should this issue go to?', [
			{ label: 'extrachill-blog (main)', message: 'extrachill-blog' },
			{ label: 'extrachill-seo', message: 'extrachill-seo' },
			{ label: 'extrachill-admin-tools', message: 'extrachill-admin-tools' },
			{ label: 'Unsure', message: 'Unsure' },
		]),
		proseTurn(
			'prose-1',
			'Which repo should this issue go to?\n\n' +
				'- **extrachill-blog (main)** (homepage rendering/blocks)\n' +
				'- **extrachill-seo** (SEO/meta)\n' +
				'- **extrachill-admin-tools** (admin tooling)\n' +
				'- **Unsure**',
		),
	];

	const markup = renderMarkup(messages);

	// The card renders (all four choices as buttons).
	assert.equal(buttonCount(markup), 4, 'all four choices render as card buttons');
	// The prose restatement is suppressed: the parenthetical descriptions that
	// ONLY appear in the prose bullet list must not survive (the card choice
	// labels carry no such descriptions).
	assert.doesNotMatch(markup, /homepage rendering\/blocks/, 'prose restatement is suppressed');
	assert.doesNotMatch(markup, /SEO\/meta/, 'prose restatement is suppressed');
	assert.doesNotMatch(markup, /admin tooling/, 'prose restatement is suppressed');
});

test('present_question card + UNRELATED assistant prose => BOTH render', () => {
	const messages = [
		...questionToolGroup('Which repo should this issue go to?', [
			{ label: 'extrachill-blog', message: 'extrachill-blog' },
			{ label: 'extrachill-seo', message: 'extrachill-seo' },
		]),
		proseTurn(
			'prose-2',
			'I checked the recent commits and the homepage block was last touched two weeks ago. Take your time deciding.',
		),
	];

	const markup = renderMarkup(messages);

	assert.equal(buttonCount(markup), 2, 'the card still renders both choices');
	assert.match(
		markup,
		/I checked the recent commits/,
		'legitimate follow-up prose is preserved',
	);
});

test('a yes/no card + prose restating both options as a list => only the card renders', () => {
	// The prose carries a sentinel string ("right now") that never appears in
	// the card, so its absence proves the prose turn was dropped — robust to the
	// question text also appearing in the card's aria-label.
	const messages = [
		...questionToolGroup('Do you want me to file the GitHub issue now?', [
			{ label: 'Yes, file it', message: 'Yes, file it' },
			{ label: 'Not yet', message: 'Not yet' },
		]),
		proseTurn(
			'prose-3',
			'Do you want me to file the GitHub issue right now?\n\n- **Yes, file it**\n- **Not yet**',
		),
	];

	const markup = renderMarkup(messages);

	assert.equal(buttonCount(markup), 2, 'both yes/no choices render as buttons');
	assert.doesNotMatch(markup, /right now/, 'the prose restatement is suppressed');
});

test('suppression can be turned off with suppressRedundantQuestionProse=false', () => {
	const messages = [
		...questionToolGroup('Pick one', [
			{ label: 'Alpha', message: 'Alpha' },
			{ label: 'Beta', message: 'Beta' },
		]),
		// "the sentinel option" appears only in the prose, never in the card.
		proseTurn('prose-4', 'Pick one of the sentinel option\n\n- **Alpha**\n- **Beta**'),
	];

	const markup = renderToStaticMarkup(
		createElement(ChatMessages, {
			showTools: true,
			suppressRedundantQuestionProse: false,
			shapeRenderers: [createQuestionToolRenderer()],
			messages,
		}),
	);

	// With suppression off, the prose-only sentinel survives.
	assert.match(markup, /the sentinel option/, 'prose is preserved when suppression is disabled');
});

// ---------------------------------------------------------------------------
// Unit: deterministic restatement detection
// ---------------------------------------------------------------------------

test('isRedundantQuestionRestatement: matches a markdown list of the same labels', () => {
	const payload = {
		question: 'Which repo?',
		choices: [{ label: 'extrachill-blog' }, { label: 'extrachill-seo' }],
	};

	assert.equal(
		isRedundantQuestionRestatement(
			'Which repo?\n\n- **extrachill-blog**\n- **extrachill-seo**',
			payload,
		),
		true,
	);
});

test('isRedundantQuestionRestatement: ignores flowing prose that merely name-drops an option', () => {
	const payload = {
		question: 'Which repo?',
		choices: [{ label: 'extrachill-blog' }, { label: 'extrachill-seo' }],
	};

	// Mentions a label but is not a list — must NOT be suppressed.
	assert.equal(
		isRedundantQuestionRestatement(
			'I think extrachill-blog is the most likely home, but it is your call.',
			payload,
		),
		false,
	);
});

test('isRedundantQuestionRestatement: a list missing a choice is not suppressed (full coverage required)', () => {
	const payload = {
		question: 'Which repo?',
		choices: [{ label: 'extrachill-blog' }, { label: 'extrachill-seo' }, { label: 'extrachill-admin-tools' }],
	};

	assert.equal(
		isRedundantQuestionRestatement('- **extrachill-blog**\n- **extrachill-seo**', payload),
		false,
		'a partial restatement (one label missing) is left untouched',
	);
});

test('isRedundantQuestionRestatement: empty content is never a restatement', () => {
	assert.equal(
		isRedundantQuestionRestatement('   ', { question: 'Q', choices: [{ label: 'A' }] }),
		false,
	);
});
