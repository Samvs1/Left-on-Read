/**
 * Display names, including anonymous mode: consistent, fun aliases per person
 * index and hidden excerpts.
 */
import { useStore } from './store';
import { useLang, dict } from '../i18n';

export function aliasFor(i: number, lang: 'en' | 'nl'): string {
  const list = dict(lang).anon.aliases.split(';');
  const base = list[i % list.length]!;
  return i < list.length ? base : `${base} ${Math.floor(i / list.length) + 1}`;
}

export interface Namer {
  anonymous: boolean;
  name: (i: number) => string;
  title: string;
}

export function useNamer(): Namer {
  const lang = useLang();
  const anonymous = useStore((s) => s.anonymize);
  const chat = useStore((s) => s.chat);
  const people = chat?.summary.people ?? [];
  const selfLabel = dict(lang).common.you;
  const name = (i: number) => {
    if (i < 0) return dict(lang).common.others;
    if (anonymous) return aliasFor(i, lang);
    const n = people[i] ?? '?';
    return n === 'You' ? selfLabel : n;
  };
  const isGroup = chat?.summary.isGroup ?? false;
  let title: string;
  if (anonymous) title = isGroup ? dict(lang).anon.groupTitle : dict(lang).anon.title;
  else if (isGroup) title = chat?.summary.title ?? people.slice(0, 3).join(', ');
  else title = chat?.summary.title ?? people.map((_, i) => name(i)).join(' & ');
  return { anonymous, name, title };
}

export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 1).toUpperCase() || '?';
  if (parts.length === 1) return Array.from(parts[0]!).slice(0, 2).join('').toUpperCase();
  return (Array.from(parts[0]!)[0]! + Array.from(parts[parts.length - 1]!)[0]!).toUpperCase();
}
