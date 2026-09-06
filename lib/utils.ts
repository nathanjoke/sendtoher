/**
 * Small, dependency-free helpers shared by Sender and Receiver.
 */

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted = exponent === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${formatted} ${units[exponent]}`;
}

export function generateRoomCode(): string {
  // Exactly 4 digits, 0000-9999, zero-padded.
  const code = Math.floor(Math.random() * 10000);
  return code.toString().padStart(4, "0");
}

export function isValidRoomCode(code: string): boolean {
  return /^\d{4}$/.test(code);
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
