import { Children, type ReactNode } from 'react';
import { SliderArrows } from './SliderArrows';

/**
 * Horizontal story rail — docs/DESIGN.md § Slider. SERVER component.
 *
 * Deliberately NOT a carousel library (40–150KB, scroll hijack, layout
 * shift): the track is a native CSS scroll-snap overflow (`.slider__track`)
 * that swipes on touch, scrolls with a trackpad, arrow-keys when focused,
 * and renders identically with JavaScript disabled. The ONLY scripted part
 * is the arrow pair, split into the tiny client component SliderArrows,
 * which finds the track by id — so every slide stays server-rendered HTML.
 *
 * The track itself is Tab-focusable (tabIndex=0 + role="region" +
 * aria-label): keyboard-scrollability of a scrollable region is a WCAG
 * requirement, and it is why the arrows can stay hidden from keyboard users.
 */
export function StorySlider({
  children,
  label,
  count,
  id,
}: {
  /** The slides. Each direct child is wrapped in a snap-aligned `.slider__slide`. */
  children: ReactNode;
  /** Accessible name for the scroll region, e.g. "More from the Hub". */
  label: string;
  /** Slide count, announced with the region label. */
  count: number;
  /**
   * DOM id for the track — the join key the client arrows use. Defaults to a
   * slug of the label; pass explicitly if two same-labelled rails ever share
   * a page.
   */
  id?: string;
}) {
  const trackId = id ?? `slider-${slugify(label)}`;

  return (
    <div className="slider">
      <SliderArrows trackId={trackId} />

      <div
        id={trackId}
        className="slider__track"
        role="region"
        aria-label={`${label}, ${count} stories`}
        tabIndex={0}
      >
        {Children.map(children, (child) =>
          child === null || child === undefined || child === false ? null : (
            <div className="slider__slide">{child}</div>
          ),
        )}
      </div>
    </div>
  );
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'rail'
  );
}
