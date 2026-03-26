import type { ChatMessage } from './types/index.ts';

export function formatChatAsMarkdown( messages: ChatMessage[] ): string {
	return messages
		.filter( ( message ) => {
			if ( message.role === 'system' || message.role === 'tool_call' ) {
				return false;
			}

			return true;
		} )
		.map( ( message ) => {
			const timestamp = message.timestamp
				? new Date( message.timestamp ).toLocaleString()
				: '';
			const timestampStr = timestamp ? ` (${ timestamp })` : '';

			if ( message.role === 'tool_result' ) {
				const toolName = message.toolResult?.toolName ?? 'Tool';
				const success = message.toolResult?.success;
				const status = success === false ? 'FAILED' : 'SUCCESS';
				return `**Tool Response (${ toolName } - ${ status })${ timestampStr }:**\n${ message.content }`;
			}

			const role = message.role === 'user' ? 'User' : 'Assistant';
			return `**${ role }${ timestampStr }:**\n${ message.content }`;
		} )
		.join( '\n\n---\n\n' );
}

export async function copyChatAsMarkdown( messages: ChatMessage[] ): Promise< string > {
	const markdown = formatChatAsMarkdown( messages );

	if ( typeof navigator === 'undefined' || ! navigator.clipboard?.writeText ) {
		throw new Error( 'Clipboard API is not available.' );
	}

	await navigator.clipboard.writeText( markdown );

	return markdown;
}
