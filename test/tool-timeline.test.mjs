import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMessageTimeline, buildToolGroups } from '../dist/tool-timeline.js';

const message = (overrides) => ({
	id: overrides.id,
	role: overrides.role,
	content: overrides.content ?? '',
	timestamp: overrides.timestamp ?? '2026-01-01T00:00:00.000Z',
	...overrides,
});

const toolCall = (id, name, parameters = {}) => ({ id, name, parameters });

const toolResult = (id, toolName, content, options = {}) => message({
	id,
	role: 'tool_result',
	content,
	toolResult: {
		toolName,
		success: options.success ?? true,
		...(options.toolCallId ? { toolCallId: options.toolCallId } : {}),
	},
});

test('pairs tool calls and results by tool call ID before tool name', () => {
	const messages = [
		message({
			id: 'assistant-1',
			role: 'assistant',
			toolCalls: [
				toolCall('call-a', 'search', { query: 'first' }),
				toolCall('call-b', 'search', { query: 'second' }),
			],
		}),
		toolResult('result-b', 'search', 'second result', { toolCallId: 'call-b' }),
		toolResult('result-a', 'search', 'first result', { toolCallId: 'call-a' }),
	];

	const groups = buildToolGroups(messages);

	assert.equal(groups.length, 2);
	assert.equal(groups[0].resultMessage?.id, 'result-a');
	assert.equal(groups[1].resultMessage?.id, 'result-b');
});

test('pairs repeated tool names without IDs in message order', () => {
	const messages = [
		message({
			id: 'assistant-1',
			role: 'assistant',
			toolCalls: [
				toolCall('', 'search', { query: 'first' }),
				toolCall('', 'search', { query: 'second' }),
			],
		}),
		toolResult('result-1', 'search', 'first result'),
		toolResult('result-2', 'search', 'second result'),
	];

	const groups = buildToolGroups(messages);

	assert.equal(groups.length, 2);
	assert.equal(groups[0].resultMessage?.id, 'result-1');
	assert.equal(groups[1].resultMessage?.id, 'result-2');
});

test('keeps orphaned tool results as tool groups', () => {
	const messages = [
		message({ id: 'user-1', role: 'user', content: 'Run something' }),
		toolResult('result-orphan', 'deploy', '{"ok":false}', { success: false, toolCallId: 'missing-call' }),
	];

	const timeline = buildMessageTimeline(messages, { showTools: true });

	assert.equal(timeline.length, 2);
	assert.equal(timeline[0].type, 'message');
	assert.equal(timeline[1].type, 'tool-group');
	assert.equal(timeline[1].group.callMessage.id, 'result-orphan');
	assert.equal(timeline[1].group.resultMessage?.id, 'result-orphan');
	assert.equal(timeline[1].group.success, false);
});

test('keeps unmatched tool calls pending', () => {
	const messages = [
		message({
			id: 'assistant-1',
			role: 'assistant',
			content: '',
			toolCalls: [toolCall('call-a', 'search', { query: 'missing' })],
		}),
	];

	const groups = buildToolGroups(messages);

	assert.equal(groups.length, 1);
	assert.equal(groups[0].resultMessage, null);
	assert.equal(groups[0].success, null);
});
