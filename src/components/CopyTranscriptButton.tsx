import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage } from '../types/index.ts';
import { copyChatAsMarkdown } from '../transcript.ts';

export interface CopyTranscriptButtonProps {
	messages: ChatMessage[];
	label?: string;
	copiedLabel?: string;
	className?: string;
	copyTimeoutMs?: number;
	onCopy?: ( markdown: string ) => void;
	onError?: ( error: Error ) => void;
}

export function CopyTranscriptButton( {
	messages,
	label = 'Copy',
	copiedLabel = 'Copied!',
	className,
	copyTimeoutMs = 2000,
	onCopy,
	onError,
}: CopyTranscriptButtonProps ) {
	const [ isCopied, setIsCopied ] = useState( false );

	useEffect( () => {
		if ( ! isCopied ) {
			return undefined;
		}

		const timer = window.setTimeout( () => setIsCopied( false ), copyTimeoutMs );
		return () => window.clearTimeout( timer );
	}, [ isCopied, copyTimeoutMs ] );

	const handleClick = useCallback( async () => {
		try {
			const markdown = await copyChatAsMarkdown( messages );
			setIsCopied( true );
			onCopy?.( markdown );
		} catch ( error ) {
			onError?.( error as Error );
		}
	}, [ messages, onCopy, onError ] );

	const baseClass = 'ec-chat-copy';
	const classes = [ baseClass, className ].filter( Boolean ).join( ' ' );

	return (
		<button
			type="button"
			className={ classes }
			onClick={ handleClick }
			disabled={ messages.length === 0 }
		>
			{ isCopied ? copiedLabel : label }
		</button>
	);
}
