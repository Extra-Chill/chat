import { useMemo } from 'react';
import type { ChatCitation, ChatMessage } from './types/index.ts';

/**
 * Return citations attached to a message with invalid entries removed.
 */
export function getMessageCitations(message: ChatMessage | null | undefined): ChatCitation[] {
	return (message?.citations ?? []).filter(isRenderableCitation);
}

/**
 * React helper for components that need stable message citation lists.
 */
export function useMessageCitations(message: ChatMessage | null | undefined): ChatCitation[] {
	return useMemo(() => getMessageCitations(message), [message]);
}

function isRenderableCitation(citation: ChatCitation): boolean {
	return Boolean(
		citation.url
		|| citation.snippet
		|| citation.source?.url
		|| citation.source?.title
		|| citation.source?.label
		|| citation.source?.id
	);
}
