import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
	/** Content to render when an error occurs. */
	fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
	/** Called when an error is caught. */
	onError?: (error: Error, errorInfo: ErrorInfo) => void;
	/** Children to render. */
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

/**
 * Error boundary for the chat UI.
 *
 * Catches React render errors and shows a fallback UI with retry.
 * Resets automatically when children change via key prop.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		this.props.onError?.(error, errorInfo);
	}

	reset = () => {
		this.setState({ error: null });
	};

	override render() {
		const { error } = this.state;
		const { fallback, children } = this.props;

		if (error) {
			if (typeof fallback === 'function') {
				return fallback(error, this.reset);
			}

			if (fallback) {
				return fallback;
			}

			return (
				<div className="ec-chat-error">
					<p className="ec-chat-error__message">Something went wrong in the chat.</p>
					<button
						className="ec-chat-error__retry"
						onClick={this.reset}
						type="button"
					>
						Try again
					</button>
				</div>
			);
		}

		return children;
	}
}
