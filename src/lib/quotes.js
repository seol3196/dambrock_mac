import quotesMarkdown from '../../격언.md?raw';

export const quotes = quotesMarkdown
  .split(/\r?\n/)
  .map((line) => line.replace(/^\s*\*\*\d+\.\*\*\s*/, '').trim())
  .filter(Boolean);

export function pickRandomQuote() {
  if (!quotes.length) return '';
  return quotes[Math.floor(Math.random() * quotes.length)];
}
