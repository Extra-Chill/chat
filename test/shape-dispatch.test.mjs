import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ChatMessages } from '../dist/components/ChatMessages.js';
import { createQuestionToolRenderer } from '../dist/tool-renderers.js';

// A tool call + result pair whose result carries a {question, choices} shape,
// but whose tool name is deliberately NOT "present_question".
const messages = (toolName, resultContent) => [
	{
		id: 'assistant-1',
		role: 'assistant',
		content: '',
		timestamp: '2026-01-01T00:00:00.000Z',
		toolCalls: [{ id: 'call-1', name: toolName, parameters: {} }],
	},
	{
		id: 'result-1',
		role: 'tool_result',
		content: resultContent,
		timestamp: '2026-01-01T00:00:01.000Z',
		toolResult: { toolName, success: true, toolCallId: 'call-1' },
	},
];

const buttonCount = (markup) => (markup.match(/<button\b/g) ?? []).length;

test('shape renderer renders a QuestionCard for a tool NOT named present_question', () => {
	const markup = renderToStaticMarkup(
		createElement(ChatMessages, {
			showTools: true,
			shapeRenderers: [createQuestionToolRenderer()],
			messages: messages(
				'file_feature_request',
				JSON.stringify({
					result: {
						question: 'Which repo should this issue go to?',
						choices: [
							{ label: 'extrachill-blog', message: 'extrachill-blog' },
							{ label: 'extrachill-roadie', message: 'extrachill-roadie' },
						],
					},
				}),
			),
		}),
	);

	assert.match(markup, />Which repo should this issue go to\?</, 'the question text renders');
	assert.equal(buttonCount(markup), 2, 'both choices render as clickable buttons');
	assert.doesNotMatch(markup, /ec-chat-tool__json/, 'it does not fall through to the default ToolMessage JSON dump');
});

test('shape renderer is skipped (falls through to ToolMessage) when there is no question shape', () => {
	const markup = renderToStaticMarkup(
		createElement(ChatMessages, {
			showTools: true,
			shapeRenderers: [createQuestionToolRenderer()],
			messages: messages('deploy', JSON.stringify({ result: { ok: true } })),
		}),
	);

	// No QuestionCard; the default collapsible ToolMessage is used instead.
	assert.match(markup, /ec-chat-tool\b/, 'default ToolMessage renders for an unrecognized shape');
});

test('tool-name renderers still take precedence over shape renderers', () => {
	const markup = renderToStaticMarkup(
		createElement(ChatMessages, {
			showTools: true,
			toolRenderers: {
				custom_tool: () => createElement('div', { className: 'name-keyed-wins' }, 'name-keyed'),
			},
			shapeRenderers: [createQuestionToolRenderer()],
			messages: messages(
				'custom_tool',
				JSON.stringify({ result: { question: 'Should not render', choices: [{ label: 'A' }] } }),
			),
		}),
	);

	assert.match(markup, /name-keyed-wins/, 'the name-keyed renderer is used');
	assert.doesNotMatch(markup, />Should not render</, 'the shape renderer did not fire');
});
