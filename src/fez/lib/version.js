// Release version, mirroring dboss and lux-fw: ./.version holds v<main commit
// count>, stamped by bin/deploy. It renders dotted - b and c are the last two
// digits of the count, a is the rest: v357 -> v3.5.7, v1123 -> v11.2.3,
// v5 -> v0.0.5. Anything else (dev, a dotted tag) is returned unchanged.
export function formatVersion(raw) {
  const count = /^v(\d+)$/.exec(String(raw).trim())?.[1];
  if (!count) {
    return String(raw).trim();
  }
  const digits = count.padStart(3, '0');
  return `v${Number(digits.slice(0, -2))}.${digits.at(-2)}.${digits.at(-1)}`;
}
