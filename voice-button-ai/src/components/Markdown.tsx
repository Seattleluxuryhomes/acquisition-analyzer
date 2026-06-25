import { type ReactNode } from 'react';

/**
 * Tiny, dependency-free Markdown renderer for AI results.
 *
 * Handles the subset models actually emit — bold, italics, inline code, fenced
 * code, headings, ordered/unordered lists, blockquotes, and paragraphs. Builds
 * React elements (no dangerouslySetInnerHTML), so it's injection-safe, and
 * tolerates partial/streaming input (an unclosed `**` just renders literally
 * until it closes). Copy still uses the raw text, so nothing is lost on paste.
 */

const INLINE = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`)/g;

function inline(text: string, kp: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const bold = m[2] ?? m[3];
    const ital = m[4] ?? m[5];
    if (bold != null) out.push(<strong key={`${kp}-b${i}`} className="font-semibold text-white">{bold}</strong>);
    else if (ital != null) out.push(<em key={`${kp}-i${i}`}>{ital}</em>);
    else if (m[6] != null) out.push(
      <code key={`${kp}-c${i}`} className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]">{m[6]}</code>,
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  const blockStart = (l: string) =>
    /^\s*[-*]\s+/.test(l) ||
    /^\s*\d+\.\s+/.test(l) ||
    /^#{1,6}\s+/.test(l) ||
    /^\s*>\s?/.test(l) ||
    l.trim().startsWith('```');

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) buf.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={k++} className="my-2 overflow-auto rounded-lg bg-black/30 p-2.5 text-[0.92em] leading-relaxed">
          {buf.join('\n')}
        </pre>,
      );
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const cls = lvl <= 1 ? 'text-sm font-bold' : lvl === 2 ? 'text-[0.95em] font-bold' : 'font-semibold';
      blocks.push(
        <p key={k++} className={`mb-1 mt-3 ${cls} text-zinc-100`}>{inline(h[2], `h${k}`)}</p>,
      );
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*[-*]\s+/, ''), `ul${k}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ul key={k++} className="my-1.5 ml-4 list-disc space-y-1">{items}</ul>);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*\d+\.\s+/, ''), `ol${k}-${items.length}`)}</li>);
        i++;
      }
      blocks.push(<ol key={k++} className="my-1.5 ml-5 list-decimal space-y-1">{items}</ol>);
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(
        <blockquote key={k++} className="my-2 border-l-2 border-white/20 pl-3 text-zinc-300">
          {inline(buf.join(' '), `bq${k}`)}
        </blockquote>,
      );
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Paragraph
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !blockStart(lines[i])) buf.push(lines[i++]);
    blocks.push(
      <p key={k++} className="my-1.5 leading-relaxed">
        {buf.map((pt, idx) => (
          <span key={idx}>
            {inline(pt, `p${k}-${idx}`)}
            {idx < buf.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}
