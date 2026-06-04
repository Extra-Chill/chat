import { type ReactNode, useId, useState } from 'react';
import { Chat, type ChatProps } from '../Chat.tsx';

export interface FloatingChatShellState {
	open: boolean;
	expanded: boolean;
	unreadCount: number;
	setOpen: ( open: boolean ) => void;
	toggleOpen: () => void;
	setExpanded: ( expanded: boolean ) => void;
	toggleExpanded: () => void;
	close: () => void;
}

export type FloatingChatShellSlot = ReactNode | ( ( state: FloatingChatShellState ) => ReactNode );

export interface FloatingChatShellProps extends Omit< ChatProps, 'isVisible' | 'onUnreadChange' > {
	/** Controlled open state. Omit to let the shell manage visibility. */
	open?: boolean;
	/** Initial open state for uncontrolled usage. Defaults to false. */
	defaultOpen?: boolean;
	/** Called when the shell requests an open state change. */
	onOpenChange?: ( open: boolean ) => void;
	/** Controlled expanded state. Omit to let the shell manage panel size. */
	expanded?: boolean;
	/** Initial expanded state for uncontrolled usage. Defaults to false. */
	defaultExpanded?: boolean;
	/** Called when the shell requests an expanded state change. */
	onExpandedChange?: ( expanded: boolean ) => void;
	/** Called whenever the composed Chat reports unread count changes. */
	onUnreadChange?: ( totalUnread: number ) => void;
	/** Additional CSS class name on the shell root. */
	shellClassName?: string;
	/** Additional CSS class name on the floating panel. */
	panelClassName?: string;
	/** Additional CSS class name on the launcher wrapper. */
	launcherClassName?: string;
	/** Optional title rendered in the default shell header. */
	title?: ReactNode;
	/** Custom launcher slot. Receives shell state when provided as a function. */
	launcher?: FloatingChatShellSlot;
	/** Custom header slot. Receives shell state when provided as a function. */
	header?: FloatingChatShellSlot;
	/** Custom actions slot rendered in the default header. */
	actions?: FloatingChatShellSlot;
	/** Accessible label for the default launcher. */
	launcherLabel?: string;
	/** Accessible label for the default close button. */
	closeLabel?: string;
	/** Accessible label for the default expand button. */
	expandLabel?: string;
	/** Accessible label for the default collapse button. */
	collapseLabel?: string;
}

function renderSlot( slot: FloatingChatShellSlot | undefined, state: FloatingChatShellState ): ReactNode {
	return typeof slot === 'function' ? slot( state ) : slot;
}

export function FloatingChatShell( {
	open,
	defaultOpen = false,
	onOpenChange,
	expanded,
	defaultExpanded = false,
	onExpandedChange,
	onUnreadChange,
	shellClassName,
	panelClassName,
	launcherClassName,
	title = 'Chat',
	launcher,
	header,
	actions,
	launcherLabel = 'Open chat',
	closeLabel = 'Close chat',
	expandLabel = 'Expand chat',
	collapseLabel = 'Collapse chat',
	className,
	...chatProps
}: FloatingChatShellProps ) {
	const panelId = useId();
	const [ internalOpen, setInternalOpen ] = useState( defaultOpen );
	const [ internalExpanded, setInternalExpanded ] = useState( defaultExpanded );
	const [ unreadCount, setUnreadCount ] = useState( 0 );
	const resolvedOpen = open ?? internalOpen;
	const resolvedExpanded = expanded ?? internalExpanded;

	const setOpen = ( nextOpen: boolean ): void => {
		if ( open === undefined ) {
			setInternalOpen( nextOpen );
		}
		onOpenChange?.( nextOpen );
	};
	const setExpanded = ( nextExpanded: boolean ): void => {
		if ( expanded === undefined ) {
			setInternalExpanded( nextExpanded );
		}
		onExpandedChange?.( nextExpanded );
	};
	const state: FloatingChatShellState = {
		open: resolvedOpen,
		expanded: resolvedExpanded,
		unreadCount,
		setOpen,
		toggleOpen: () => setOpen( ! resolvedOpen ),
		setExpanded,
		toggleExpanded: () => setExpanded( ! resolvedExpanded ),
		close: () => setOpen( false ),
	};
	const renderedLauncher = renderSlot( launcher, state );
	const renderedHeader = renderSlot( header, state );
	const renderedActions = renderSlot( actions, state );
	const shellClasses = [
		'ec-chat-shell',
		resolvedOpen ? 'ec-chat-shell--open' : undefined,
		resolvedExpanded ? 'ec-chat-shell--expanded' : undefined,
		shellClassName,
	].filter( Boolean ).join( ' ' );
	const panelClasses = [ 'ec-chat-shell__panel', panelClassName ].filter( Boolean ).join( ' ' );
	const chatClasses = [ 'ec-chat-shell__chat', className ].filter( Boolean ).join( ' ' );

	return (
		<div className={ shellClasses }>
			<div className={ [ 'ec-chat-shell__launcher', launcherClassName ].filter( Boolean ).join( ' ' ) }>
				{ renderedLauncher ?? (
					<button
						type="button"
						className="ec-chat-shell__launcher-button"
						aria-controls={ panelId }
						aria-expanded={ resolvedOpen }
						onClick={ state.toggleOpen }
					>
						<span>{ launcherLabel }</span>
						{ unreadCount > 0 && (
							<span className="ec-chat-shell__badge" aria-label={ `${ unreadCount } unread` }>
								{ unreadCount }
							</span>
						) }
					</button>
				) }
			</div>

			<section
				id={ panelId }
				className={ panelClasses }
				aria-label={ typeof title === 'string' ? title : 'Chat' }
				hidden={ ! resolvedOpen }
			>
				{ renderedHeader ?? (
					<div className="ec-chat-shell__header">
						<div className="ec-chat-shell__title">{ title }</div>
						<div className="ec-chat-shell__actions">
							{ renderedActions }
							<button
								type="button"
								className="ec-chat-shell__control"
								onClick={ state.toggleExpanded }
								aria-label={ resolvedExpanded ? collapseLabel : expandLabel }
							>
								{ resolvedExpanded ? 'Collapse' : 'Expand' }
							</button>
							<button
								type="button"
								className="ec-chat-shell__control"
								onClick={ state.close }
								aria-label={ closeLabel }
							>
								Close
							</button>
						</div>
					</div>
				) }

				<Chat
					{ ...chatProps }
					className={ chatClasses }
					isVisible={ resolvedOpen }
					onUnreadChange={ ( totalUnread ) => {
						setUnreadCount( totalUnread );
						onUnreadChange?.( totalUnread );
					} }
				/>
			</section>
		</div>
	);
}
