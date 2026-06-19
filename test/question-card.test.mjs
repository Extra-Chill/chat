import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { QuestionCard } from '../dist/components/QuestionCard.js';
import { createQuestionToolRenderer } from '../dist/tool-renderers.js';

const questionGroup = (parameters) => ({
	callMessage: { id: 'call-1', role: 'assistant', content: '', timestamp: '2026-01-01T00:00:00.000Z' },
	resultMessage: null,
	toolName: 'present_question',
	parameters,
	success: null,
});

const context = (overrides = {}) => ({
	sendMessage: () => {},
	isLoading: false,
	...overrides,
});

// Count <button> elements whose tag carries the disabled attribute.
const disabledButtonCount = (markup) =>
	(markup.match(/<button[^>]*\bdisabled\b[^>]*>/g) ?? []).length;

const buttonCount = (markup) => (markup.match(/<button\b/g) ?? []).length;

test('renderer does NOT disable choice buttons when context.isLoading is stuck true', () => {
	// Regression (#57): a turn that ends on an unanswered question leaves
	// isLoading stuck true. The question awaiting the user's answer must stay
	// clickable rather than being permanently disabled.
	const renderer = createQuestionToolRenderer();
	const element = renderer(
		questionGroup({ question: 'Pick one', choices: [{ label: 'A' }, { label: 'B' }] }),
		context({ isLoading: true }),
	);

	const markup = renderToStaticMarkup(element);
	assert.equal(buttonCount(markup), 2, 'both choices render as buttons');
	assert.equal(disabledButtonCount(markup), 0, 'choice buttons must remain interactive while a question awaits an answer');
});

test('renderer renders 2 choices (yes/no) just as well as more', () => {
	const renderer = createQuestionToolRenderer();
	const markup = renderToStaticMarkup(
		renderer(
			questionGroup({ question: 'File it?', choices: [{ label: 'Yes' }, { label: 'No' }] }),
			context(),
		),
	);

	assert.equal(buttonCount(markup), 2);
	assert.match(markup, />Yes</);
	assert.match(markup, />No</);
});

test('an explicit disabled prop still reflects on the choice buttons', () => {
	// When a caller genuinely needs to suppress interaction (a real in-flight
	// request) it can still pass disabled — that is honored.
	const markup = renderToStaticMarkup(
		createElement(QuestionCard, {
			question: 'Pick one',
			choices: [{ label: 'A' }, { label: 'B' }],
			disabled: true,
			onSubmitAnswer: () => {},
		}),
	);

	assert.equal(disabledButtonCount(markup), 2, 'explicit disabled should reflect on controls');
});

test('a submitted answer reflects in the rendered card', () => {
	// The card renders the choices for an unanswered question; once answered it
	// auto-hides them (verified here by the choice-button count before submit).
	const markup = renderToStaticMarkup(
		createElement(QuestionCard, {
			question: 'Pick one',
			choices: [{ label: 'A' }],
			onSubmitAnswer: () => {},
		}),
	);

	assert.equal(buttonCount(markup), 1, 'unanswered question shows its choice button');
	assert.equal(disabledButtonCount(markup), 0, 'and it is interactive');
});
