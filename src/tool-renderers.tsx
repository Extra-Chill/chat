import type { ReactNode } from 'react';
import { DiffCard, type DiffCardProps } from './components/DiffCard.tsx';
import { QuestionCard, type QuestionChoice, type QuestionChoicePresentation } from './components/QuestionCard.tsx';
import type { ToolGroup, ToolRenderer, ToolRendererContext } from './components/ToolMessage.tsx';
import { parseCanonicalDiffFromToolGroup } from './diff.ts';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonObject(value: string): UnknownRecord | null {
	try {
		const parsed = JSON.parse(value);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function readString(source: UnknownRecord, keys: string[]): string | undefined {
	for (const key of keys) {
		const value = source[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}

	return undefined;
}

function readStringArray(source: UnknownRecord, keys: string[]): string[] | undefined {
	for (const key of keys) {
		const value = source[key];
		if (!Array.isArray(value)) {
			continue;
		}

		const strings = value
			.filter((item): item is string => typeof item === 'string')
			.map((item) => item.trim())
			.filter(Boolean);

		if (strings.length > 0) {
			return strings;
		}
	}

	return undefined;
}

function readNumber(source: UnknownRecord, keys: string[]): number | undefined {
	for (const key of keys) {
		const value = source[key];
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
	}

	return undefined;
}

function titleFromKey(value: string): string {
	return value
		.replace(/[-_]+/g, ' ')
		.replace(/\b\w/g, (match) => match.toUpperCase());
}

function resultSourceFromToolGroup(group: ToolGroup): UnknownRecord | null {
	const result = group.resultMessage ? parseJsonObject(group.resultMessage.content) : null;
	return isRecord(result?.result)
		? result.result
		: isRecord(result?.data)
			? result.data
			: result;
}

export interface PendingActionDiffRendererOptions {
	/** Called when the user accepts the staged change. */
	onAccept?: DiffCardProps['onAccept'];
	/** Called when the user rejects the staged change. */
	onReject?: DiffCardProps['onReject'];
	/** Whether the diff actions are currently disabled. */
	loading?: DiffCardProps['loading'];
	/** Additional CSS class name passed to DiffCard. */
	className?: string;
	/** Rendered when the tool group does not contain a parseable diff. */
	fallback?: ToolRenderer;
}

export function createPendingActionDiffRenderer(options: PendingActionDiffRendererOptions = {}): ToolRenderer {
	return (group, context) => {
		const diff = parseCanonicalDiffFromToolGroup(group);
		if (!diff) {
			return options.fallback?.(group, context) ?? null;
		}

		return (
			<DiffCard
				diff={diff}
				onAccept={options.onAccept}
				onReject={options.onReject}
				loading={options.loading}
				className={options.className}
			/>
		);
	};
}

export interface QuestionToolPayload {
	question: string;
	choices: QuestionChoice[];
}

function normalizeQuestionChoicePresentation(value: unknown): QuestionChoicePresentation | undefined {
	if (!isRecord(value)) {
		return undefined;
	}

	const swatches = readStringArray(value, ['swatches']);
	const layoutHint = readString(value, ['layout_hint', 'layoutHint']);
	const imageSource = isRecord(value.image) ? value.image : null;
	const imageUrl = imageSource ? readString(imageSource, ['url']) : undefined;
	const image = imageUrl
		? {
			url: imageUrl,
			alt: imageSource ? readString(imageSource, ['alt']) : undefined,
		}
		: undefined;
	const fontSampleSource = isRecord(value.font_sample)
		? value.font_sample
		: isRecord(value.fontSample)
			? value.fontSample
			: null;
	const fontSample = fontSampleSource
		? {
			heading: readString(fontSampleSource, ['heading']),
			body: readString(fontSampleSource, ['body']),
			heading_font: readString(fontSampleSource, ['heading_font', 'headingFont']),
			body_font: readString(fontSampleSource, ['body_font', 'bodyFont']),
		}
		: undefined;
	const normalizedFontSample = fontSample && (fontSample.heading || fontSample.body) ? fontSample : undefined;

	const presentation: QuestionChoicePresentation = {};
	if (swatches) presentation.swatches = swatches;
	if (normalizedFontSample) presentation.font_sample = normalizedFontSample;
	if (image) presentation.image = image;
	if (layoutHint) presentation.layout_hint = layoutHint;

	return Object.keys(presentation).length > 0 ? presentation : undefined;
}

function normalizeQuestionChoice(value: unknown): QuestionChoice | null {
	if (!isRecord(value)) {
		return null;
	}

	const label = typeof value.label === 'string' ? value.label.trim() : '';
	if (!label) {
		return null;
	}

	return {
		label,
		message: typeof value.message === 'string' ? value.message : undefined,
		description: typeof value.description === 'string' ? value.description : undefined,
		presentation: normalizeQuestionChoicePresentation(value.presentation),
	};
}

export function parseQuestionPayloadFromToolGroup(group: ToolGroup): QuestionToolPayload | null {
	const resultSource = resultSourceFromToolGroup(group);
	const source = resultSource && typeof resultSource.question === 'string' ? resultSource : group.parameters;
	const question = typeof source.question === 'string' ? source.question.trim() : '';
	if (!question) {
		return null;
	}

	const choices = Array.isArray(source.choices)
		? source.choices.map(normalizeQuestionChoice).filter((choice): choice is QuestionChoice => !!choice)
		: [];

	return {
		question,
		choices,
	};
}

export interface QuestionToolRendererOptions {
	/** Called with the selected or typed answer. Defaults to context.sendMessage. */
	onSubmitAnswer?: (answer: string, group: ToolGroup, context: ToolRendererContext) => void;
	/**
	 * Whether controls are disabled. Defaults to `false`: a question awaiting
	 * the user's answer is always interactive. It is intentionally NOT gated on
	 * `context.isLoading` — a turn that ends on an unanswered question can leave
	 * `isLoading` stuck true, which previously made the choice buttons
	 * permanently un-clickable. Pass a value (or predicate) only if a caller
	 * genuinely needs to suppress interaction.
	 */
	disabled?: boolean | ((group: ToolGroup, context: ToolRendererContext) => boolean);
	/** Collapse choices after the user submits an answer. */
	autoHideOnSubmit?: boolean;
	/** Additional CSS class name passed to QuestionCard. */
	className?: string;
	/** Rendered when the tool group does not contain a parseable question. */
	fallback?: ToolRenderer;
}

export function createQuestionToolRenderer(options: QuestionToolRendererOptions = {}): ToolRenderer {
	return (group, context) => {
		const payload = parseQuestionPayloadFromToolGroup(group);
		if (!payload) {
			return options.fallback?.(group, context) ?? null;
		}

		const disabled = typeof options.disabled === 'function'
			? options.disabled(group, context)
			: options.disabled ?? false;

		return (
			<QuestionCard
				question={payload.question}
				choices={payload.choices}
				disabled={disabled}
				autoHideOnSubmit={options.autoHideOnSubmit}
				className={options.className}
				onSubmitAnswer={(answer) => {
					if (options.onSubmitAnswer) {
						options.onSubmitAnswer(answer, group, context);
						return;
					}

					context.sendMessage(answer);
				}}
			/>
		);
	};
}

export type ArtifactStatus = 'pending' | 'running' | 'ready' | 'completed' | 'failed' | 'retrying';

export interface ArtifactStatusThumbnail {
	url: string;
	alt?: string;
}

export interface ArtifactStatusPayload {
	title: string;
	phase: string;
	status: ArtifactStatus;
	description?: string;
	diagnosticsCount?: number;
	previewUrl?: string;
	resultUrl?: string;
	thumbnails: ArtifactStatusThumbnail[];
	error?: string;
}

function normalizeArtifactStatus(value: unknown): ArtifactStatus | null {
	if (typeof value !== 'string') {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	return normalized === 'pending'
		|| normalized === 'running'
		|| normalized === 'ready'
		|| normalized === 'completed'
		|| normalized === 'failed'
		|| normalized === 'retrying'
		? normalized
		: null;
}

function firstNestedRecord(source: UnknownRecord, keys: string[]): UnknownRecord | null {
	for (const key of keys) {
		const record = source[key];
		if (isRecord(record)) {
			return record;
		}
	}

	return null;
}

function unwrapArtifactSource(source: UnknownRecord): UnknownRecord {
	return firstNestedRecord(source, [
		'artifact',
		'artifact_phase',
		'artifactPhase',
		'artifact_status',
		'artifactStatus',
		'phase_metadata',
		'phaseMetadata',
		'phase',
		'phase_status',
		'phaseStatus',
	]) ?? source;
}

function collectArtifactSources(group: ToolGroup): UnknownRecord[] {
	const sources: UnknownRecord[] = [group.parameters];
	const result = group.resultMessage ? parseJsonObject(group.resultMessage.content) : null;
	if (result) {
		sources.push(result);
		if (isRecord(result.result)) {
			sources.push(result.result);
		}
		if (isRecord(result.data)) {
			sources.push(result.data);
		}
	}

	return sources.map(unwrapArtifactSource);
}

function getSourceValue(sources: UnknownRecord[], keys: string[]): unknown {
	for (const source of sources) {
		for (const key of keys) {
			if (source[key] !== undefined && source[key] !== null) {
				return source[key];
			}
		}
	}

	return undefined;
}

function readSourceString(sources: UnknownRecord[], keys: string[]): string | undefined {
	for (const source of sources) {
		const value = readString(source, keys);
		if (value) {
			return value;
		}
	}

	return undefined;
}

function readSourceNumber(sources: UnknownRecord[], keys: string[]): number | undefined {
	for (const source of sources) {
		const value = readNumber(source, keys);
		if (value !== undefined) {
			return value;
		}
	}

	return undefined;
}

function normalizeThumbnail(value: unknown): ArtifactStatusThumbnail | null {
	if (typeof value === 'string' && value.trim()) {
		return { url: value.trim() };
	}

	if (!isRecord(value)) {
		return null;
	}

	const url = readString(value, ['thumbnail_url', 'thumbnailUrl', 'thumb_url', 'thumbUrl', 'url', 'src']);
	if (!url) {
		return null;
	}

	return {
		url,
		alt: readString(value, ['alt', 'alt_text', 'altText', 'label', 'title']),
	};
}

function collectArtifactThumbnails(sources: UnknownRecord[]): ArtifactStatusThumbnail[] {
	const thumbnailValue = getSourceValue(sources, ['thumbnails', 'thumbnail_urls', 'thumbnailUrls', 'assets', 'imported_assets', 'importedAssets']);
	const rawThumbnails = Array.isArray(thumbnailValue)
		? thumbnailValue
		: thumbnailValue
			? [thumbnailValue]
			: [];

	return rawThumbnails
		.map(normalizeThumbnail)
		.filter((thumbnail): thumbnail is ArtifactStatusThumbnail => !!thumbnail)
		.slice(0, 4);
}

function diagnosticsCount(sources: UnknownRecord[]): number | undefined {
	const explicitCount = readSourceNumber(sources, ['diagnostics_count', 'diagnosticsCount', 'diagnostic_count', 'diagnosticCount']);
	if (explicitCount !== undefined) {
		return explicitCount;
	}

	const diagnostics = getSourceValue(sources, ['diagnostics', 'issues', 'warnings']);
	if (Array.isArray(diagnostics)) {
		return diagnostics.length;
	}

	return isRecord(diagnostics) ? Object.keys(diagnostics).length : undefined;
}

function errorMessage(sources: UnknownRecord[]): string | undefined {
	const explicitError = readSourceString(sources, ['error', 'error_message', 'errorMessage', 'failure_reason', 'failureReason']);
	if (explicitError) {
		return explicitError;
	}

	for (const source of sources) {
		const error = source.error;
		const message = isRecord(error) ? readString(error, ['message', 'detail']) : undefined;
		if (message) {
			return message;
		}
	}

	return undefined;
}

export function parseArtifactStatusFromToolGroup(group: ToolGroup): ArtifactStatusPayload | null {
	const sources = collectArtifactSources(group);
	const phase = readSourceString(sources, ['phase', 'artifact_phase', 'artifactPhase', 'step', 'stage']);
	const statusFromSuccess = group.success === false
		? 'failed'
		: group.success === true
			? 'completed'
			: null;
	const status = normalizeArtifactStatus(getSourceValue(sources, ['status', 'state', 'phase_status', 'phaseStatus'])) ?? statusFromSuccess;

	if (!phase || !status) {
		return null;
	}

	return {
		title: readSourceString(sources, ['title', 'label', 'name']) ?? titleFromKey(phase),
		phase,
		status,
		description: readSourceString(sources, ['description', 'message', 'summary', 'detail']),
		diagnosticsCount: diagnosticsCount(sources),
		previewUrl: readSourceString(sources, ['preview_url', 'previewUrl', 'url']),
		resultUrl: readSourceString(sources, ['result_url', 'resultUrl', 'final_url', 'finalUrl', 'materialized_url', 'materializedUrl']),
		thumbnails: collectArtifactThumbnails(sources),
		error: errorMessage(sources),
	};
}

export interface ArtifactStatusCardLabels {
	status?: Partial<Record<ArtifactStatus, string>>;
	description?: Partial<Record<ArtifactStatus, string>>;
	previewLink?: string;
	resultLink?: string;
	diagnostics?: (count: number) => string;
	thumbnailGroup?: string;
}

export interface ArtifactStatusCardProps {
	payload: ArtifactStatusPayload;
	labels?: ArtifactStatusCardLabels;
	className?: string;
}

const defaultStatusLabels: Record<ArtifactStatus, string> = {
	pending: 'Pending',
	running: 'Running',
	ready: 'Ready',
	completed: 'Completed',
	failed: 'Failed',
	retrying: 'Retrying',
};

const defaultDescriptions: Record<ArtifactStatus, string> = {
	pending: 'Waiting to start.',
	running: 'In progress.',
	ready: 'Ready.',
	completed: 'Completed successfully.',
	failed: 'Failed.',
	retrying: 'Retrying.',
};

export function ArtifactStatusCard({ payload, labels, className }: ArtifactStatusCardProps) {
	const baseClass = 'ec-chat-artifact';
	const hasError = payload.status === 'failed';
	const linkUrl = payload.resultUrl ?? payload.previewUrl;
	const linkLabel = payload.resultUrl
		? labels?.resultLink ?? 'Open result'
		: labels?.previewLink ?? 'Open preview';
	const classes = [baseClass, `${baseClass}--${payload.status}`, hasError ? `${baseClass}--error` : '', className].filter(Boolean).join(' ');
	const description = payload.description ?? labels?.description?.[payload.status] ?? defaultDescriptions[payload.status];

	return (
		<div className={classes}>
			<div className={`${baseClass}__header`}>
				<div>
					<div className={`${baseClass}__title`}>{payload.title}</div>
					<div className={`${baseClass}__phase`}>{payload.phase}</div>
				</div>
				<span className={`${baseClass}__status`}>{labels?.status?.[payload.status] ?? defaultStatusLabels[payload.status]}</span>
			</div>
			<p className={`${baseClass}__description`}>{description}</p>
			{payload.thumbnails.length > 0 && (
				<div className={`${baseClass}__thumbnails`} aria-label={labels?.thumbnailGroup ?? 'Artifacts'}>
					{payload.thumbnails.map((thumbnail, index) => (
						<img key={`${thumbnail.url}-${index}`} src={thumbnail.url} alt={thumbnail.alt ?? ''} loading="lazy" />
					))}
				</div>
			)}
			{(payload.diagnosticsCount !== undefined || linkUrl) && (
				<div className={`${baseClass}__meta`}>
					{payload.diagnosticsCount !== undefined && (
						<span className={`${baseClass}__meta-item`}>
							{labels?.diagnostics?.(payload.diagnosticsCount) ?? `${payload.diagnosticsCount} diagnostics`}
						</span>
					)}
					{linkUrl && (
						<a className={`${baseClass}__link`} href={linkUrl} target="_blank" rel="noreferrer">
							{linkLabel}
						</a>
					)}
				</div>
			)}
			{hasError && payload.error && <p className={`${baseClass}__error`}>{payload.error}</p>}
		</div>
	);
}

export interface ArtifactStatusToolRendererOptions {
	labels?: ArtifactStatusCardLabels;
	className?: string;
	/** Override the card renderer while reusing the generic parser. */
	render?: (payload: ArtifactStatusPayload, group: ToolGroup, context: ToolRendererContext) => ReactNode;
	/** Rendered when the tool group does not contain a parseable artifact status. */
	fallback?: ToolRenderer;
}

export function createArtifactStatusToolRenderer(options: ArtifactStatusToolRendererOptions = {}): ToolRenderer {
	return (group, context) => {
		const payload = parseArtifactStatusFromToolGroup(group);
		if (!payload) {
			return options.fallback?.(group, context) ?? null;
		}

		return options.render?.(payload, group, context) ?? (
			<ArtifactStatusCard payload={payload} labels={options.labels} className={options.className} />
		);
	};
}
