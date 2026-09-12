/**
 * Hand-written WP REST v2 shapes — only the fields this app consumes.
 * Optionality here mirrors the API contract, not the happy path: on this
 * install a featured image is set on 99 of 100 sampled posts and `_embedded`
 * resolved on 19 of 20, but nothing guarantees either — every child of
 * `_embedded` can be absent on any given post.
 */

export interface WPRendered {
  rendered: string;
}

export interface WPProtectedRendered extends WPRendered {
  protected?: boolean;
}

/** WP embeds an error object in place of a resource it cannot expand. */
export interface WPEmbedError {
  code: string;
  message: string;
  data?: { status: number };
}

export interface WPImageSize {
  file?: string;
  width: number;
  height: number;
  mime_type?: string;
  source_url: string;
}

export interface WPMediaDetails {
  width?: number;
  height?: number;
  file?: string;
  filesize?: number;
  sizes?: Record<string, WPImageSize>;
}

export interface WPMedia {
  id: number;
  date?: string;
  slug?: string;
  type?: string;
  link?: string;
  title?: WPRendered;
  author?: number;
  caption?: WPRendered;
  alt_text?: string;
  media_type?: string;
  mime_type?: string;
  media_details?: WPMediaDetails;
  source_url?: string;
}

export interface WPTerm {
  id: number;
  link?: string;
  name: string;
  slug: string;
  taxonomy?: string;
}

export interface WPCategory {
  id: number;
  count: number;
  description?: string;
  link: string;
  name: string;
  slug: string;
  taxonomy?: string;
  parent?: number;
}

export interface WPAuthor {
  id: number;
  name: string;
  slug: string;
  url?: string;
  description?: string;
  link?: string;
  avatar_urls?: Record<string, string>;
}

/**
 * The `_embed` payload. Every key is optional, and `wp:featuredmedia`
 * entries may be error objects rather than media — narrow before use.
 */
export interface WPEmbedded {
  author?: Array<WPAuthor | WPEmbedError>;
  'wp:featuredmedia'?: Array<WPMedia | WPEmbedError>;
  /** Grouped by taxonomy: typically [categories[], tags[]] — order not guaranteed. */
  'wp:term'?: Array<WPTerm[] | undefined>;
}

export interface WPPost {
  id: number;
  date: string;
  date_gmt?: string;
  modified: string;
  modified_gmt?: string;
  slug: string;
  status?: string;
  type?: string;
  /** Canonical WP permalink — the authority on this network's URL shape. */
  link: string;
  title: WPRendered;
  content: WPProtectedRendered;
  excerpt: WPProtectedRendered;
  author?: number;
  featured_media?: number;
  sticky?: boolean;
  format?: string;
  categories?: number[];
  tags?: number[];
  _embedded?: WPEmbedded;
}

/** Trimmed shape returned by `_fields=slug,modified,date`. */
export interface WPPostSlugRef {
  slug: string;
  modified: string;
  date: string;
}

export function isEmbedError(value: unknown): value is WPEmbedError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as WPEmbedError).code === 'string'
  );
}
