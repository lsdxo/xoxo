export function icon(name: string, size = 24): string {
  const paths: Record<string, string> = {
    hoe: '<path d="m8 21 9-15M8 5c4-3 9-2 13 1l-2 4c-4-3-7-4-11-2Z"/>',
    seed: '<path d="M12 21V10M12 15C4 15 3 10 4 6c6-1 9 3 8 7m0-3c0-5 4-7 9-7 0 6-4 9-9 9"/>',
    water: '<path d="M5 11h11v9H5zM8 11V7c0-5 8-5 8 0v4m0 3 5-5 2 2-7 8M2 12h3"/><path d="m21 17 1 2m-4 1 1 2"/>',
    harvest: '<path d="m3 10 3 11h12l3-11H3Zm4 0 5-8 5 8M9 14v3m6-3v3"/>',
    shop: '<path d="M3 9h18l-2-6H5L3 9Zm1 1v11h16V10M8 21v-7h8v7M3 9c0 4 5 4 5 0 0 4 8 4 8 0 0 4 5 4 5 0"/>',
    home: '<path d="m2 11 10-8 10 8M5 10v11h14V10M9 21v-7h6v7"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14 7h-3a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4h-3m2-10v12"/>',
    sound: '<path d="M11 4 5 9H2v6h3l6 5V4Zm4 4c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/>',
    mute: '<path d="M11 4 5 9H2v6h3l6 5V4Zm5 5 6 6m0-6-6 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 8c0-3 6-3 6 0 0 2-3 2-3 5m0 3v1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    leaf: '<path d="M20 3C7 2 1 9 6 16c7 5 14-1 14-13ZM4 21l10-11"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    moon: '<path d="M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12Z"/>',
    arrow: '<path d="m8 4 8 8-8 8"/>',
    save: '<path d="M5 3h12l4 4v14H3V3h2Zm2 0v7h10V3M7 21v-7h10v7"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.leaf}</svg>`;
}
