/**
 * Lightweight markdown-to-HTML converter for chat messages.
 *
 * Handles the subset of markdown that LLM responses typically produce:
 * headings, bold, italic, inline code, code blocks, links, lists,
 * and paragraphs. Not a full CommonMark parser — just enough for
 * clean chat rendering without heavy dependencies.
 */

const ESCAPED: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
};

function escapeHtml(text: string): string {
	return text.replace(/[&<>"]/g, (ch) => ESCAPED[ch] ?? ch);
}

/**
 * Convert inline markdown to HTML.
 * Order matters — code spans must be processed before bold/italic
 * to avoid mangling backtick contents.
 */
function inlineMarkdown(text: string): string {
	let html = escapeHtml(text);

	// Inline code (must come first to protect contents)
	html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

	// Bold + italic
	html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
	// Bold
	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	// Italic
	html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

	// Links [text](url)
	html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

	return html;
}

/**
 * Parse markdown string into HTML.
 */
export function markdownToHtml(source: string): string {
	const lines = source.split('\n');
	const output: string[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code block
		if (line.startsWith('```')) {
			const lang = line.slice(3).trim();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith('```')) {
				codeLines.push(escapeHtml(lines[i]));
				i++;
			}
			i++; // skip closing ```
			const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
			output.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
			continue;
		}

		// Heading
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headingMatch) {
			const level = headingMatch[1].length;
			output.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
			i++;
			continue;
		}

		// Horizontal rule
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
			output.push('<hr>');
			i++;
			continue;
		}

		// Unordered list
		if (/^\s*[-*+]\s/.test(line)) {
			const listItems: string[] = [];
			while (i < lines.length && /^\s*[-*+]\s/.test(lines[i])) {
				listItems.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`);
				i++;
			}
			output.push(`<ul>${listItems.join('')}</ul>`);
			continue;
		}

		// Ordered list
		if (/^\s*\d+[.)]\s/.test(line)) {
			const listItems: string[] = [];
			while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
				listItems.push(`<li>${inlineMarkdown(lines[i].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
				i++;
			}
			output.push(`<ol>${listItems.join('')}</ol>`);
			continue;
		}

		// Empty line — skip (paragraph breaks handled by grouping)
		if (line.trim() === '') {
			i++;
			continue;
		}

		// Paragraph — collect consecutive non-empty, non-special lines
		const paraLines: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim() !== '' &&
			!lines[i].startsWith('```') &&
			!lines[i].match(/^#{1,6}\s/) &&
			!/^\s*[-*+]\s/.test(lines[i]) &&
			!/^\s*\d+[.)]\s/.test(lines[i]) &&
			!/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
		) {
			paraLines.push(lines[i]);
			i++;
		}
		if (paraLines.length > 0) {
			output.push(`<p>${inlineMarkdown(paraLines.join('\n'))}</p>`);
		}
	}

	return output.join('');
}
