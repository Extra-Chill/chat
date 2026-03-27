import type { ChatSession } from '../types/index.ts';

export interface SessionSwitcherProps {
	/** List of available sessions. */
	sessions: ChatSession[];
	/** Currently active session ID. */
	activeSessionId?: string;
	/** Called when a session is selected. */
	onSelect: (sessionId: string) => void;
	/** Called when the user wants to create a new session. */
	onNew?: () => void;
	/** Called when the user wants to delete a session. */
	onDelete?: (sessionId: string) => void;
	/** Whether sessions are currently loading. */
	loading?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Session switcher dropdown.
 *
 * Shared default for browsing saved chat history without noisy horizontal chips.
 */
export function SessionSwitcher({
	sessions,
	activeSessionId,
	onSelect,
	onNew,
	onDelete,
	loading = false,
	className,
}: SessionSwitcherProps) {
	const baseClass = 'ec-chat-sessions';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const currentSessionId = activeSessionId ?? sessions[0]?.id ?? '';

	return (
		<div className={classes}>
			<div className={`${baseClass}__header`}>
				<span className={`${baseClass}__title`}>Conversations</span>
				{onNew && (
					<button
						className={`${baseClass}__new`}
						onClick={onNew}
						aria-label="New conversation"
						type="button"
					>
						+
					</button>
				)}
			</div>

			{loading && <div className={`${baseClass}__loading`}>Loading...</div>}

			{sessions.length > 0 && (
				<div className={`${baseClass}__controls`}>
					<label className={`${baseClass}__select-wrap`}>
						<span className="screen-reader-text">Select conversation</span>
						<select
							className={`${baseClass}__select`}
							value={currentSessionId}
							onChange={(event) => onSelect(event.target.value)}
							disabled={loading}
						>
							{sessions.map((session) => (
								<option key={session.id} value={session.id}>
									{session.title ?? `Session ${session.id.slice(0, 8)}`} — {formatRelativeDate(session.updatedAt)}
								</option>
							))}
						</select>
					</label>

					{onDelete && currentSessionId && (
						<button
							className={`${baseClass}__delete`}
							onClick={() => onDelete(currentSessionId)}
							aria-label="Delete selected conversation"
							type="button"
						>
							Delete
						</button>
					)}
				</div>
			)}
		</div>
	);
}

function formatRelativeDate(iso: string): string {
	try {
		const date = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60_000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;

		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;

		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;

		return date.toLocaleDateString();
	} catch {
		return '';
	}
}
