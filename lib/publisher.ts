import type { SiteConfig } from '../config/sites';

/**
 * Rendering helpers for the optional publisher identity fields.
 *
 * Company number, ICO registration and registered address may not exist yet.
 * Rather than printing "[TODO: …]" on legal pages — which is worse than
 * silence and actively misleading — every consumer asks these helpers whether
 * there is anything to show. Fill the values in `config/sites.ts` and the
 * sentences appear across About, Contact, Privacy, Terms and the footer with
 * no further edits.
 */

function present(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** The entity to name as publisher — the legal name if set, else the masthead. */
export function publisherName(site: SiteConfig): string {
  const { legalName } = site.publisher;
  return present(legalName) ? legalName : site.name;
}

export function hasLegalName(site: SiteConfig): boolean {
  return present(site.publisher.legalName);
}

export function hasCompanyNumber(site: SiteConfig): boolean {
  return present(site.publisher.companyNumber);
}

export function hasIcoRegistration(site: SiteConfig): boolean {
  return present(site.publisher.icoRegistration);
}

/** "12 Example Street, EC1A 1AA" — empty string when no address is configured. */
export function postalAddress(site: SiteConfig): string {
  return [site.publisher.addressLine, site.publisher.postalCode]
    .filter(present)
    .join(', ');
}

export function hasPostalAddress(site: SiteConfig): boolean {
  return postalAddress(site).length > 0;
}

/**
 * The footer's registration line, assembled from whatever exists.
 * Returns an empty string when nothing does, so the footer can skip the row
 * entirely instead of rendering separators around nothing.
 */
export function registrationLine(site: SiteConfig): string {
  const { legalName, companyNumber, icoRegistration } = site.publisher;
  const parts: string[] = [];
  if (present(legalName)) parts.push(legalName);
  if (present(companyNumber)) parts.push(`Company no. ${companyNumber}`);
  if (present(icoRegistration)) parts.push(`ICO reg. ${icoRegistration}`);
  return parts.join(' · ');
}
