import { useState, type ReactNode } from 'react';
import { personColor, onPersonColor } from '../colors';
import { useDark } from '../theme';
import { initials, useNamer } from '../names';
import { useT } from '../../i18n';
import { Icon } from './Icon';
import type { Excerpt as ExcerptT } from '../../engine/types';
import { fmtDateTime, fmtNum } from '../format';

export function Avatar({ person, size = 40, ring = false }: { person: number; size?: number; ring?: boolean }) {
  const dark = useDark();
  const { name } = useNamer();
  const color = personColor(person, dark);
  return (
    <span
      aria-hidden="true"
      className="inline-grid shrink-0 place-items-center rounded-full font-display font-bold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: color,
        color: onPersonColor(person),
        boxShadow: ring ? `0 0 0 3px var(--surface), 0 0 0 5px ${color}` : undefined,
      }}
    >
      {initials(name(person))}
    </span>
  );
}

export function PersonChip({ person, onClick, sub }: { person: number; onClick?: () => void; sub?: ReactNode }) {
  const { name } = useNamer();
  const content = (
    <>
      <Avatar person={person} size={28} />
      <span className="min-w-0">
        <span className="block truncate font-semibold leading-tight">{name(person)}</span>
        {sub && <span className="block text-xs leading-tight text-muted">{sub}</span>}
      </span>
    </>
  );
  if (!onClick) return <span className="inline-flex min-w-0 items-center gap-2">{content}</span>;
  return (
    <button type="button" onClick={onClick} className="inline-flex min-w-0 items-center gap-2 rounded-full pr-2 text-left transition-colors hover:bg-surface-2">
      {content}
    </button>
  );
}

/** Swatch used next to text: identity is carried by the mark, never by coloured text. */
export function Swatch({ person, color }: { person?: number; color?: string }) {
  const dark = useDark();
  return <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: color ?? personColor(person ?? -1, dark) }} />;
}

export function StatTile({ label, value, sub, icon, accent }: { label: string; value: ReactNode; sub?: ReactNode; icon?: Parameters<typeof Icon>[0]['name']; accent?: string }) {
  return (
    <div className="card relative flex min-w-0 flex-col justify-between gap-3 overflow-hidden p-4 sm:p-5">
      <div className="flex items-start gap-2 text-sm font-semibold leading-tight text-muted">
        {icon && (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: accent ? `${accent}1f` : 'var(--surface-2)', color: accent ?? 'var(--ink-2)' }}>
            <Icon name={icon} size={15} />
          </span>
        )}
        <span className="line-clamp-2 min-w-0 pt-1">{label}</span>
      </div>
      <div>
        <div className="num text-[2rem] sm:text-[2.4rem]">{value}</div>
        {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      </div>
    </div>
  );
}

export interface BarItem {
  label: ReactNode;
  value: number;
  display?: string;
  /** Per-person split (indices in people order). */
  split?: number[];
  person?: number;
  key: string;
}

/** Ranked horizontal bars in plain HTML (accessible text, no chart engine needed). */
export function BarList({ items, max, onSelect, showSplit = true, emptyText }: { items: BarItem[]; max?: number; onSelect?: (key: string) => void; showSplit?: boolean; emptyText?: string }) {
  const dark = useDark();
  const t = useT();
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="py-6 text-center text-sm text-muted">{emptyText ?? t('common.notEnoughData')}</p>;
  return (
    <ol className="space-y-2.5">
      {items.map((it, rank) => {
        const width = Math.max(2, (it.value / top) * 100);
        const total = it.split ? it.split.reduce((a, b) => a + b, 0) : 0;
        const Row = onSelect ? 'button' : 'div';
        return (
          <li key={it.key}>
            <Row
              {...(onSelect ? { type: 'button' as const, onClick: () => onSelect(it.key) } : {})}
              className={`group grid w-full grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-left ${onSelect ? 'rounded-xl hover:bg-surface-2' : ''}`}
            >
              <span className="tabular text-right text-xs font-semibold text-muted">{rank + 1}</span>
              <span className="min-w-0 truncate text-[0.95rem] font-medium">{it.label}</span>
              <span className="tabular text-sm font-semibold text-ink-2">{it.display ?? fmtNum(it.value)}</span>
              <span />
              <span className="col-span-2 flex h-2 overflow-hidden rounded-full bg-surface-2" style={{ width: `${width}%` }} aria-hidden="true">
                {showSplit && it.split && total > 0 ? (
                  it.split.map((v, p) =>
                    v > 0 ? <span key={p} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(v / total) * 100}%`, background: personColor(p, dark), marginRight: 2 }} /> : null,
                  )
                ) : (
                  <span className="h-full w-full rounded-full" style={{ background: personColor(it.person ?? -1, dark), opacity: it.person === undefined ? 0.85 : 1, ...(it.person === undefined ? { background: 'var(--brand)' } : {}) }} />
                )}
              </span>
            </Row>
          </li>
        );
      })}
    </ol>
  );
}

/** A message excerpt rendered as a chat bubble. Hidden in anonymous mode. */
export function Bubble({ ex, side, compact = false }: { ex: ExcerptT; side?: 'left' | 'right'; compact?: boolean }) {
  const { name, anonymous } = useNamer();
  const dark = useDark();
  const t = useT();
  const s = side ?? (ex.author === 0 ? 'right' : 'left');
  const color = personColor(ex.author, dark);
  return (
    <figure className={`flex max-w-full flex-col ${s === 'right' ? 'items-end' : 'items-start'}`}>
      <figcaption className="mb-1 flex items-center gap-1.5 px-1 text-xs text-muted">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="font-semibold text-ink-2">{name(ex.author)}</span>
        {!compact && <span>· {fmtDateTime(ex.ts)}</span>}
      </figcaption>
      <blockquote
        className={`max-w-[min(30rem,92%)] whitespace-pre-wrap break-words rounded-[1.25rem] px-4 py-2.5 text-[0.95rem] leading-snug ${
          s === 'right' ? 'rounded-br-md' : 'rounded-bl-md'
        } ${anonymous ? 'italic text-muted' : ''}`}
        style={{ background: s === 'right' ? (dark ? '#2a2445' : '#ece8ff') : 'var(--surface-2)' }}
      >
        {anonymous ? t('common.hidden') : ex.text || <span className="italic text-muted">{ex.type}</span>}
      </blockquote>
    </figure>
  );
}

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

/** Card that hosts one chart: title, plain-language takeaway, chart, text alternative and table view. */
export function ChartCard({
  id,
  title,
  takeaway,
  children,
  table,
  actions,
  className = '',
  wide = false,
}: {
  id?: string;
  title: string;
  takeaway?: string | null;
  children: ReactNode;
  table?: TableData | null;
  actions?: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  const t = useT();
  const [showTable, setShowTable] = useState(false);
  return (
    <section id={id} className={`card min-w-0 p-4 sm:p-6 ${wide ? 'lg:col-span-2' : ''} ${className}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id ? `${id}-title` : undefined} className="text-[1.15rem] font-bold leading-tight sm:text-[1.25rem]">
            {title}
          </h3>
          {takeaway && <p className="mt-1.5 text-[0.95rem] leading-snug text-ink-2">{takeaway}</p>}
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0 items-center">
          {actions}
          {table && table.rows.length > 0 && (
            <button type="button" className="icon-btn" aria-pressed={showTable} onClick={() => setShowTable((v) => !v)} title={showTable ? t('common.hideTable') : t('common.showTable')} aria-label={showTable ? t('common.hideTable') : t('common.showTable')}>
              <Icon name="table" size={18} />
            </button>
          )}
        </div>
      </header>
      {showTable && table ? <DataTable table={table} /> : children}
    </section>
  );
}

export function DataTable({ table }: { table: TableData }) {
  return (
    <div className="max-h-[22rem] overflow-auto rounded-xl border border-line">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {table.columns.map((c) => (
              <th key={c} scope="col" className="px-3 py-2 text-left font-semibold text-ink-2">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-1.5 ${typeof c === 'number' ? 'tabular text-right' : ''}`}>
                  {typeof c === 'number' ? fmtNum(c, 2) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionHeader({ id, eyebrow, title, children }: { id: string; eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-5 mt-14 flex flex-wrap items-end justify-between gap-3 first:mt-4" id={`section-${id}`}>
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 id={`${id}-heading`} className="text-[2rem] font-[750] leading-none sm:text-[2.6rem]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
