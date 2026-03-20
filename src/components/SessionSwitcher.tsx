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
 * Renders a list of sessions with the active one highlighted.
 * Only rendered when the adapter declares `capabilities.sessions = true`.
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

			{loading && (
				<div className={`${baseClass}__loading`}>Loading...</div>
			)}

			<ul className={`${baseClass}__list`} role="listbox" aria-label="Chat sessions">
				{sessions.map((session) => {
					const isActive = session.id === activeSessionId;
					const itemClass = [
						`${baseClass}__item`,
						isActive ? `${baseClass}__item--active` : '',
					].filter(Boolean).join(' ');

					return (
						<li
							key={session.id}
							className={itemClass}
							role="option"
							aria-selected={isActive}
						>
							<button
								className={`${baseClass}__item-button`}
								onClick={() => onSelect(session.id)}
								type="button"
							>
								<span className={`${baseClass}__item-title`}>
									{session.title ?? `Session ${session.id.slice(0, 8)}`}
								</span>
								<time
									className={`${baseClass}__item-date`}
									dateTime={session.updatedAt}
								>
									{formatRelativeDate(session.updatedAt)}
								</time>
							</button>
							{onDelete && (
								<button
									className={`${baseClass}__item-delete`}
									onClick={(e) => {
										e.stopPropagation();
										onDelete(session.id);
									}}
									aria-label={`Delete session ${session.title ?? session.id}`}
									type="button"
								>
									\u00D7
								</button>
							)}
						</li>
					);
				})}
			</ul>
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
