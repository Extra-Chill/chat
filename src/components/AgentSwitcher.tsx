export interface AgentSwitcherAgent {
	/** Stable agent identifier used as the select value. */
	id: string;
	/** Human-readable agent name. */
	name: string;
	/** Optional short description for consumers that display richer options. */
	description?: string;
}

export interface AgentSwitcherProps {
	/** Available agents. */
	agents: AgentSwitcherAgent[];
	/** Currently selected agent ID. */
	activeAgentId?: string;
	/** Called when a different agent is selected. */
	onSelect: (agentId: string) => void;
	/** Visible switcher title. Defaults to 'Agent'. */
	title?: string;
	/** Accessible label for the select. Defaults to 'Select agent'. */
	selectLabel?: string;
	/** Placeholder shown when there are no agents. Defaults to 'No agents available'. */
	emptyLabel?: string;
	/** Whether the switcher is disabled. */
	disabled?: boolean;
	/** Additional CSS class name. */
	className?: string;
}

/**
 * Generic agent switcher dropdown.
 *
 * Consumers provide the agent list and persistence behavior. The component only
 * owns accessible, reusable switcher markup and styling hooks.
 */
export function AgentSwitcher({
	agents,
	activeAgentId,
	onSelect,
	title = 'Agent',
	selectLabel = 'Select agent',
	emptyLabel = 'No agents available',
	disabled = false,
	className,
}: AgentSwitcherProps) {
	const baseClass = 'ec-chat-agents';
	const classes = [baseClass, className].filter(Boolean).join(' ');
	const currentAgentId = activeAgentId ?? agents[0]?.id ?? '';

	return (
		<div className={classes}>
			<label className={`${baseClass}__select-wrap`}>
				<span className={`${baseClass}__title`}>{title}</span>
				{agents.length > 0 ? (
					<select
						className={`${baseClass}__select`}
						value={currentAgentId}
						onChange={(event) => onSelect(event.target.value)}
						aria-label={selectLabel}
						disabled={disabled}
					>
						{agents.map((agent) => (
							<option key={agent.id} value={agent.id}>
								{agent.name}
							</option>
						))}
					</select>
				) : (
					<span className={`${baseClass}__empty`}>{emptyLabel}</span>
				)}
			</label>
		</div>
	);
}
