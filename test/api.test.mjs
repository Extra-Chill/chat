import assert from 'node:assert/strict';
import test from 'node:test';

import { createSendMessageRequest } from '../dist/api.js';

test('createSendMessageRequest keeps metadata namespaced', () => {
	const request = createSendMessageRequest(
		{ basePath: '/chat', fetchFn: async () => ({}) },
		{
			content: 'hello',
			sessionId: 'session-real',
			attachments: [{ url: 'https://example.test/file.png', filename: 'file.png' }],
			metadata: {
				message: 'metadata message must not replace content',
				session_id: 'metadata-session',
				attachments: ['metadata attachment'],
				custom: 42,
			},
			clientContext: {
				viewport: 'desktop',
			},
		},
	);

	assert.equal(request.message, 'hello');
	assert.equal(request.session_id, 'session-real');
	assert.deepEqual(request.attachments, [{ url: 'https://example.test/file.png', filename: 'file.png' }]);
	assert.deepEqual(request.metadata, {
		message: 'metadata message must not replace content',
		session_id: 'metadata-session',
		attachments: ['metadata attachment'],
		custom: 42,
	});
	assert.deepEqual(request.clientContext, { viewport: 'desktop' });
});
