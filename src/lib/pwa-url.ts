/** Canonical public URL of the installable PWA dashboard. */
export const pwaUrl =
  (process.env.NEXT_PUBLIC_PWA_URL || "https://pwa-dashboard.abiaworkspace.com").replace(
    /\/$/,
    ""
  );

export const pwaUrlLabel = pwaUrl.replace(/^https?:\/\//, "");

export const pwaInstallUrl = `${pwaUrl}/start#install`;
