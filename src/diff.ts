import type { ToolGroup } from './components/ToolMessage.tsx';

export type CanonicalDiffType = 'edit' | 'replace' | 'insert';
export type CanonicalDiffStatus = 'pending' | 'accepted' | 'rejected';

export interface CanonicalDiffItem {
	blockIndex?: number;
	originalContent?: string;
	replacementContent?: string;
}

export interface CanonicalDiffEditorData {
	[key: string]: unknown;
}

export interface CanonicalDiffData {
	/**
	 * Pending-action id the backend assigned when staging this preview.
	 *
	 * This is the canonical field as of v0.11 — it aligns with the
	 * unified "pending action" primitive on the server side (any tool
	 * invocation can be staged + previewed + resolved through the same
	 * /actions/resolve endpoint, not just content diffs).
	 */
	actionId: string;
	/**
	 * Back-compat alias for `actionId`.
	 *
	 * Always populated with the same value as `actionId`. Kept so
	 * consumers that wired against the v0.7–v0.10 `diffId` field keep
	 * working through one more major version. New code should read
	 * `actionId`.
	 *
	 * @deprecated Use `actionId`.
	 */
	diffId: string;
	diffType: CanonicalDiffType;
	originalContent: string;
	replacementContent: string;
	status?: CanonicalDiffStatus;
	summary?: string;
	items?: CanonicalDiffItem[];
	position?: string;
	insertionPoint?: string;
	editor?: CanonicalDiffEditorData;
}

type UnknownRecord = Record< string, unknown >;

function isRecord( value: unknown ): value is UnknownRecord {
	return !! value && typeof value === 'object' && ! Array.isArray( value );
}

function normalizeItem( item: unknown ): CanonicalDiffItem | null {
	if ( ! isRecord( item ) ) {
		return null;
	}

	const blockIndex = typeof item.blockIndex === 'number'
		? item.blockIndex
		: typeof item.block_index === 'number'
			? item.block_index
			: undefined;

	const originalContent = typeof item.originalContent === 'string'
		? item.originalContent
		: typeof item.original_content === 'string'
			? item.original_content
			: undefined;

	const replacementContent = typeof item.replacementContent === 'string'
		? item.replacementContent
		: typeof item.replacement_content === 'string'
			? item.replacement_content
			: undefined;

	if ( blockIndex === undefined && originalContent === undefined && replacementContent === undefined ) {
		return null;
	}

	return {
		blockIndex,
		originalContent,
		replacementContent,
	};
}

export function parseCanonicalDiff( value: unknown ): CanonicalDiffData | null {
	if ( ! isRecord( value ) ) {
		return null;
	}

	const container = isRecord( value.data ) ? value.data : value;

	// Resolve the nested diff object. Preferred nesting keys, in order:
	//   - `preview`  — emitted by Data Machine's PendingActionHelper::stage()
	//                  envelope (unified pending-action primitive).
	//   - `preview_data` — same idea, snake_case variant some backends emit
	//                  when the envelope is serialized without camelCase
	//                  normalization.
	//   - `diff`     — historical shape from before the pending-action
	//                  unification.
	// If none match, the payload is assumed to already be flat (the rare
	// case where a backend builds the CanonicalDiffData by hand without
	// wrapping it in an envelope).
	const rawDiff = isRecord( container.preview )
		? container.preview
		: isRecord( container.preview_data )
			? container.preview_data
			: isRecord( container.diff )
				? container.diff
				: container;

	// Resolve the pending-action id. Prefer the canonical `actionId`
	// (server unified on pending-action vocabulary in mid-2026) and
	// fall back to the historical `diffId` / `diff_id` shapes so
	// older backends and stored payloads keep rendering.
	const resolvedId = typeof rawDiff.actionId === 'string'
		? rawDiff.actionId
		: typeof rawDiff.action_id === 'string'
			? rawDiff.action_id
			: typeof container.action_id === 'string'
				? container.action_id
				: typeof rawDiff.diffId === 'string'
					? rawDiff.diffId
					: typeof rawDiff.diff_id === 'string'
						? rawDiff.diff_id
						: typeof container.diff_id === 'string'
							? container.diff_id
							: '';

	const diffType = rawDiff.diffType === 'replace' || rawDiff.diffType === 'insert'
		? rawDiff.diffType
		: rawDiff.diffType === 'edit'
			? 'edit'
			: rawDiff.diff_type === 'replace' || rawDiff.diff_type === 'insert'
				? rawDiff.diff_type
				: 'edit';

	const originalContent = typeof rawDiff.originalContent === 'string'
		? rawDiff.originalContent
		: typeof rawDiff.original_content === 'string'
			? rawDiff.original_content
			: '';

	const replacementContent = typeof rawDiff.replacementContent === 'string'
		? rawDiff.replacementContent
		: typeof rawDiff.replacement_content === 'string'
			? rawDiff.replacement_content
			: '';

	if ( ! resolvedId && ! originalContent && ! replacementContent ) {
		return null;
	}

	const itemsSource = Array.isArray( rawDiff.items )
		? rawDiff.items
		: Array.isArray( rawDiff.edits )
			? rawDiff.edits
			: Array.isArray( rawDiff.replacements )
				? rawDiff.replacements
				: undefined;

	const items = itemsSource
		?.map( normalizeItem )
		.filter( ( item ): item is CanonicalDiffItem => item !== null );

	const summary = typeof rawDiff.summary === 'string'
		? rawDiff.summary
		: typeof container.message === 'string'
			? container.message
			: undefined;

	const status = rawDiff.status === 'accepted' || rawDiff.status === 'rejected' || rawDiff.status === 'pending'
		? rawDiff.status
		: undefined;

	return {
		actionId: resolvedId,
		diffId: resolvedId,
		diffType,
		originalContent,
		replacementContent,
		status,
		summary,
		items: items && items.length > 0 ? items : undefined,
		position: typeof rawDiff.position === 'string' ? rawDiff.position : undefined,
		insertionPoint: typeof rawDiff.insertionPoint === 'string' ? rawDiff.insertionPoint : undefined,
		editor: isRecord( rawDiff.editor ) ? rawDiff.editor : undefined,
	};
}

export function parseCanonicalDiffFromJson( json: string ): CanonicalDiffData | null {
	try {
		return parseCanonicalDiff( JSON.parse( json ) );
	} catch {
		return null;
	}
}

export function parseCanonicalDiffFromToolGroup( group: ToolGroup ): CanonicalDiffData | null {
	if ( ! group.resultMessage ) {
		return null;
	}

	return parseCanonicalDiffFromJson( group.resultMessage.content );
}
