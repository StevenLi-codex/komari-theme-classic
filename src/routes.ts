export function parseNodeId(hash: string): string | number | null {
  const part = hash.match(/^#\/node\/([^/]+)$/)?.[1];
  if (!part) return null;
  if (/^\d+$/.test(part) && Number.isSafeInteger(Number(part)))
    return Number(part);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    part,
  )
    ? part
    : null;
}
export const nodeHash = (id: string | number): string =>
  `#/node/${encodeURIComponent(String(id))}`;
export const datasetId = (id: string | undefined): string | number =>
  /^\d+$/.test(id ?? "") ? Number(id) : (id ?? "");
