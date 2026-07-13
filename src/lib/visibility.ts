import type { Domain, Indicator } from "./types";

/** Domains default to published when the flag is missing (legacy rows). */
export function isDomainPublished(domain: Pick<Domain, "is_published"> | null | undefined): boolean {
  return domain?.is_published !== false;
}

/** Indicators default to published when the flag is missing (legacy rows). */
export function isIndicatorPublished(
  indicator: Pick<Indicator, "is_published"> | null | undefined
): boolean {
  return indicator?.is_published !== false;
}

/**
 * Public visibility: indicator must be published AND its domain must be published.
 * Unpublishing a domain cascades to all indicators underneath without DB updates.
 */
export function isIndicatorPublic(
  indicator: Pick<Indicator, "domain_id" | "is_published">,
  domainById: Map<string, Pick<Domain, "is_published">>
): boolean {
  if (!isIndicatorPublished(indicator)) return false;
  return isDomainPublished(domainById.get(indicator.domain_id));
}
