export type QrPayload =
  | { kind: "device"; deviceId: string }
  | { kind: "pairing"; pairId: string; code: string }
  | { kind: "unknown"; raw: string };

export function deviceQrPayload(deviceId: string): string {
  return `SIMBRIDGE://D/${deviceId}`;
}

export function pairingQrPayload(pairId: string, code: string): string {
  return `SIMBRIDGE://P/${pairId}/${code}`;
}

export function parseQrPayload(raw: string): QrPayload {
  const value = raw.trim();
  const match = value.match(/^SIMBRIDGE:\/\/([DP])\/([^/]+)(?:\/([^/]+))?$/i);
  if (!match) return { kind: "unknown", raw: value };
  const tag = match[1].toUpperCase();
  const first = decodeURIComponent(match[2]);
  if (tag === "D") return { kind: "device", deviceId: first };
  const code = match[3] ? decodeURIComponent(match[3]) : "";
  if (!code) return { kind: "unknown", raw: value };
  return { kind: "pairing", pairId: first, code };
}
