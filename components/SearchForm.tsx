'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { searchPath } from '../lib/urls';

/**
 * Client component: genuinely interactive (controlled input + programmatic
 * navigation). Falls back to a plain GET form when JS is unavailable — the
 * `action`/`method`/`name` attributes make the no-JS submit land on
 * `/search/?q=...` exactly as the scripted path does.
 */
export function SearchForm({
  defaultValue = '',
  compact = false,
}: {
  defaultValue?: string;
  /** Set on the mobile-panel instance so the two inputs never share an id. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(searchPath(trimmed));
  }

  const id = compact ? 'q-compact' : 'q';

  return (
    <form
      action="/search/"
      method="get"
      onSubmit={onSubmit}
      role="search"
      className="search-form"
    >
      <label htmlFor={id} className="sr-only">
        Search stories
      </label>
      <input
        id={id}
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search"
        autoComplete="off"
        className="input"
      />
      <button type="submit" className="search-form__btn" aria-label="Search">
        {/* Inline SVG rather than a glyph or an icon package: the style allows
            exactly one search mark and a nav toggle, and this keeps both
            dependency-free and crisp at any size. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l4 4" strokeLinecap="square" />
        </svg>
      </button>
    </form>
  );
}
