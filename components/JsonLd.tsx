import type { JsonLdObject } from '../lib/schema';

/**
 * Renders a JSON-LD block.
 *
 * `<` is escaped so a headline containing `</script>` cannot break out of the
 * tag — the content is syndicated and must be treated as untrusted.
 *
 * One of exactly three sanctioned `dangerouslySetInnerHTML` sites in the app
 * (with ThemeScript's static IIFE and ArticleBody's sanitised HTML).
 */
export function JsonLd({ data, id }: { data: JsonLdObject; id?: string }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <script
      type="application/ld+json"
      id={id}
      // Serialised above; the only injection vector is `<`, which is escaped.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
