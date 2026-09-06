/**
 * STAGE 1 ONLY.
 *
 * These helpers fake the passage of a transfer so the UI/interaction
 * states described in the brief can all be demonstrated without a real
 * signaling server or WebRTC connection.
 *
 * Nothing here should be imported once Stage 3+ (real signaling/WebRTC)
 * lands — it exists purely to drive the mock states in Sender/Receiver.
 */

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls onProgress with increasing values up to 100, then resolves.
 */
export async function simulateProgress(
  onProgress: (percent: number) => void,
  durationMs = 1800,
  steps = 20
): Promise<void> {
  const stepDelay = durationMs / steps;
  for (let i = 1; i <= steps; i++) {
    await wait(stepDelay);
    onProgress(Math.round((i / steps) * 100));
  }
}

/**
 * A fixed demo code so the mock receiver flow has something valid to
 * accept. In Stage 2 this is replaced by a real room lookup.
 */
export const MOCK_VALID_CODE = "4821";

export const MOCK_RECEIVED_FILES = [
  { id: "mock-1", name: "photo.jpg", size: 4_200_000, type: "image/jpeg" },
  { id: "mock-2", name: "video.mp4", size: 82_400_000, type: "video/mp4" },
];
