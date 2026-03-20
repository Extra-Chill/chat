import type { ReactNode } from 'react';
import type { ChatAvailability } from '../types/index.ts';

export interface AvailabilityGateProps {
	/** Current availability state. */
	availability: ChatAvailability;
	/** Custom renderer for non-ready states. */
	renderState?: (availability: ChatAvailability) => ReactNode;
	/** Children to render when ready. */
	children: ReactNode;
}

/**
 * Gates chat UI behind availability states.
 *
 * When the adapter reports a non-ready state, this component renders
 * an appropriate message instead of the chat. Consumers can override
 * the default rendering with `renderState`.
 */
export function AvailabilityGate({
	availability,
	renderState,
	children,
}: AvailabilityGateProps) {
	if (availability.status === 'ready') {
		return <>{children}</>;
	}

	if (renderState) {
		return <>{renderState(availability)}</>;
	}

	return <DefaultAvailabilityMessage availability={availability} />;
}

function DefaultAvailabilityMessage({ availability }: { availability: ChatAvailability }) {
	const baseClass = 'ec-chat-availability';

	switch (availability.status) {
		case 'login-required':
			return (
				<div className={`${baseClass} ${baseClass}--login`}>
					<p>Please log in to use the chat.</p>
					{availability.loginUrl && (
						<a href={availability.loginUrl} className={`${baseClass}__action`}>
							Log in
						</a>
					)}
				</div>
			);

		case 'unavailable':
			return (
				<div className={`${baseClass} ${baseClass}--unavailable`}>
					<p>{availability.reason ?? 'Chat is currently unavailable.'}</p>
				</div>
			);

		case 'provisioning':
			return (
				<div className={`${baseClass} ${baseClass}--provisioning`}>
					<p>{availability.message ?? 'Setting up your chat...'}</p>
				</div>
			);

		case 'upgrade-required':
			return (
				<div className={`${baseClass} ${baseClass}--upgrade`}>
					<p>{availability.message ?? 'Upgrade required to access chat.'}</p>
					{availability.upgradeUrl && (
						<a href={availability.upgradeUrl} className={`${baseClass}__action`}>
							Upgrade
						</a>
					)}
				</div>
			);

		case 'error':
			return (
				<div className={`${baseClass} ${baseClass}--error`}>
					<p>{availability.message}</p>
				</div>
			);
	}
}
