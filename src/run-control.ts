import type { CancelRunInput, ChatRunCapabilities, FetchFn, QueueMessageInput, QueueMessageResult } from './api.ts';

export type { CancelRunInput, ChatRunCapabilities, QueueMessageInput, QueueMessageResult } from './api.ts';

export type ChatRunStatus = 'queued' | 'running' | 'cancelling' | 'cancelled' | 'completed' | 'failed';

export interface ChatRun {
	runId: string;
	sessionId: string;
	status?: ChatRunStatus;
	startedAt?: string;
	updatedAt?: string;
	metadata?: Record<string, unknown>;
}

export interface ChatRunEvent {
	/** Stable event ID, when supplied by the backend. */
	id?: string;
	/** Run this event belongs to. */
	runId: string;
	/** Session this event belongs to, when supplied by the backend. */
	sessionId?: string;
	/** Backend-agnostic event type, such as `status`, `message`, or `tool`. */
	type: string;
	/** Run status associated with the event, when present. */
	status?: ChatRunStatus;
	/** Human-readable event message, when present. */
	message?: string;
	/** Event creation time as an ISO string, when supplied by the backend. */
	createdAt?: string;
	/** Monotonic event position, when supplied by the backend. */
	sequence?: number;
	/** Event-specific data normalized by the adapter. */
	metadata?: Record<string, unknown>;
	/** Original event object for consumers that need backend-specific fields. */
	raw: Record<string, unknown>;
}

export interface ChatRunAdapter {
	capabilities?: ChatRunCapabilities;
	activeRunId?: string | null;
	getRunId?: (metadata: Record<string, unknown>) => string | null | undefined;
	cancel?: (input: CancelRunInput) => Promise<void> | void;
	queue?: (input: QueueMessageInput) => Promise<QueueMessageResult | void> | QueueMessageResult | void;
	getStatus?: (input: CancelRunInput) => Promise<ChatRun | null>;
	listEvents?: (input: CancelRunInput) => Promise<ChatRunEvent[]>;
}

export interface ChatRunAttachment {
	id?: string | number;
	url?: string;
	mimeType?: string;
	filename?: string;
	size?: number;
	metadata?: Record<string, unknown>;
}

export type ChatRunUploadFn = (file: File) => Promise<ChatRunAttachment>;

export interface RunControlAdapterOptions {
	fetchFn: FetchFn;
	/** Base path for run-control endpoints, for example `/api/chat`. */
	basePath: string;
	uploadFn?: ChatRunUploadFn;
}

function compactPath(path: string): string {
	return path.replace(/\/+/g, '/').replace(':/', '://');
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function dataRecord(value: unknown): Record<string, unknown> {
	const record = asRecord(value);
	return asRecord(record.data ?? record);
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value.trim()) return value;
	}
	return undefined;
}

function numberField(record: Record<string, unknown>, ...keys: string[]): number | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'number') return value;
	}
	return undefined;
}

function statusField(record: Record<string, unknown>): ChatRunStatus | undefined {
	const status = stringField(record, 'status');
	return status === 'queued' || status === 'running' || status === 'cancelling' ||
		status === 'cancelled' || status === 'completed' || status === 'failed'
		? status
		: undefined;
}

function normalizeRun(record: Record<string, unknown>, fallback: CancelRunInput): ChatRun | null {
	const runId = stringField(record, 'runId', 'run_id') ?? fallback.runId;
	const sessionId = stringField(record, 'sessionId', 'session_id') ?? fallback.sessionId;
	if (!runId || !sessionId) return null;

	return {
		runId,
		sessionId,
		status: statusField(record),
		startedAt: stringField(record, 'startedAt', 'started_at'),
		updatedAt: stringField(record, 'updatedAt', 'updated_at'),
		metadata: asRecord(record.metadata),
	};
}

export function normalizeRunEvent(value: unknown, fallbackRunId?: string): ChatRunEvent | null {
	const record = asRecord(value);
	const runId = stringField(record, 'runId', 'run_id') ?? fallbackRunId;
	const type = stringField(record, 'type', 'event') ?? 'event';
	if (!runId) return null;

	return {
		id: stringField(record, 'id', 'eventId', 'event_id'),
		runId,
		sessionId: stringField(record, 'sessionId', 'session_id'),
		type,
		status: statusField(record),
		message: stringField(record, 'message', 'text'),
		createdAt: stringField(record, 'createdAt', 'created_at', 'timestamp'),
		sequence: numberField(record, 'sequence', 'seq', 'position'),
		metadata: asRecord(record.metadata),
		raw: record,
	};
}

function normalizeEvents(raw: unknown, runId: string): ChatRunEvent[] {
	const data = dataRecord(raw);
	const events = Array.isArray(data.events) ? data.events : Array.isArray(raw) ? raw : [];
	return events
		.map((event) => normalizeRunEvent(event, runId))
		.filter((event): event is ChatRunEvent => !!event);
}

function normalizeQueueResult(raw: unknown, fallback: QueueMessageInput): QueueMessageResult | void {
	const data = dataRecord(raw);
	const run = fallback.runId
		? normalizeRun(data, { runId: fallback.runId, sessionId: fallback.sessionId })
		: null;

	return {
		...(run ?? {}),
		queuedMessageId: stringField(data, 'queuedMessageId', 'queued_message_id', 'messageId', 'message_id'),
		position: numberField(data, 'position', 'queuePosition', 'queue_position'),
	};
}

export function createRunControlAdapter({ fetchFn, basePath, uploadFn }: RunControlAdapterOptions): ChatRunAdapter {
	const runPath = (runId: string, suffix = '') => compactPath(`${basePath}/runs/${encodeURIComponent(runId)}${suffix}`);

	return {
		capabilities: {
			cancel: true,
			queue: true,
			status: true,
			events: true,
		},
		getRunId(metadata) {
			return stringField(metadata, 'runId', 'run_id');
		},
		async cancel({ runId, sessionId }) {
			await fetchFn({
				path: runPath(runId, '/cancel'),
				method: 'POST',
				data: { session_id: sessionId },
			});
		},
		async queue(input) {
			const attachments = input.files?.length && uploadFn
				? await Promise.all(input.files.map(uploadFn))
				: undefined;

			const raw = await fetchFn({
				path: input.runId ? runPath(input.runId, '/queue') : compactPath(`${basePath}/queue`),
				method: 'POST',
				data: {
					session_id: input.sessionId,
					run_id: input.runId,
					message: input.content,
					attachments,
				},
			});

			return normalizeQueueResult(raw, input);
		},
		async getStatus(input) {
			const raw = await fetchFn({ path: runPath(input.runId) });
			return normalizeRun(dataRecord(raw), input);
		},
		async listEvents(input) {
			const raw = await fetchFn({ path: runPath(input.runId, '/events') });
			return normalizeEvents(raw, input.runId);
		},
	};
}
