import { useState } from 'react';
import type { ChatMessage } from '../types/index.ts';

/**
 * A paired tool call + result for display.
 */
export interface ToolGroup {
	/** The message containing the tool call. */
	callMessage: ChatMessage;
	/** The result message (null if still pending). */
	resultMessage: ChatMessage | null;
	/** Tool function name. */
	toolName: string;
	/** Parameters passed to the tool. */
	parameters: Record<string, unknown>;
	/** Whether the tool succeeded (null if pending). */
	success: boolean | null;
}

export interface ToolMessageProps {
	/** The tool call/result group to display. */
	group: ToolGroup;
	/** Map of tool names to friendly display labels. */
	toolNames?: Record<string, string>;
	/** Whether the tool details are initially expanded. Defaults to false. */
	defaultExpanded?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Renders a collapsible tool call/result pair.
 *
 * Shows a summary line with the tool name (or friendly label),
 * success/error indicator, and expandable details section.
 */
export function ToolMessage({
	group,
	toolNames,
	defaultExpanded = false,
	className,
}: ToolMessageProps) {
	const [expanded, setExpanded] = useState(defaultExpanded);

	const displayName = toolNames?.[group.toolName] ?? formatToolName(group.toolName);
	const baseClass = 'ec-chat-tool';
	const statusClass = group.success === true
		? `${baseClass}--success`
		: group.success === false
			? `${baseClass}--error`
			: `${baseClass}--pending`;
	const classes = [baseClass, statusClass, className].filter(Boolean).join(' ');

	return (
		<div className={classes}>
			<button
				className={`${baseClass}__header`}
				onClick={() => setExpanded(!expanded)}
				aria-expanded={expanded}
				type="button"
			>
				<span className={`${baseClass}__icon`}>
					{group.success === true ? '\u2713' : group.success === false ? '\u2717' : '\u2026'}
				</span>
				<span className={`${baseClass}__name`}>{displayName}</span>
				<span className={`${baseClass}__chevron`}>{expanded ? '\u25B2' : '\u25BC'}</span>
			</button>

			{expanded && (
				<div className={`${baseClass}__details`}>
					{Object.keys(group.parameters).length > 0 && (
						<div className={`${baseClass}__section`}>
							<div className={`${baseClass}__section-label`}>Parameters</div>
							<pre className={`${baseClass}__json`}>
								{JSON.stringify(group.parameters, null, 2)}
							</pre>
						</div>
					)}

					{group.resultMessage && (
						<div className={`${baseClass}__section`}>
							<div className={`${baseClass}__section-label`}>Result</div>
							<pre className={`${baseClass}__json`}>
								{formatResult(group.resultMessage.content)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Convert snake_case tool name to a readable label.
 */
function formatToolName(name: string): string {
	return name
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Try to pretty-print JSON content, fall back to raw string.
 */
function formatResult(content: string): string {
	try {
		return JSON.stringify(JSON.parse(content), null, 2);
	} catch {
		return content;
	}
}
