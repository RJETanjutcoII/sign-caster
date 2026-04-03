/**
 * gestures.js
 * Shared utilities for gesture detection.
 * Each ability owns its own detect() function and imports these helpers.
 *
 * MediaPipe gives us 21 landmarks per hand, each with {x, y, z}.
 * y increases downward, so a finger is "up" when its tip y < its base y.
 *
 * Landmark indices used:
 *   4  = thumb tip
 *   8  = index tip     | 6  = index PIP  | 5  = index MCP
 *   12 = middle tip    | 10 = middle PIP | 9  = middle MCP
 *   16 = ring tip      | 14 = ring PIP   | 13 = ring MCP
 *   20 = pinky tip     | 18 = pinky PIP  | 17 = pinky MCP
 */

// Extended: tip far from wrist (rotation-invariant, distance-based)
export function isFingerExtended(lm, tipIdx) {
  const handSize = dist(lm[0], lm[9]);
  return handSize > 0.01 && dist(lm[tipIdx], lm[0]) > handSize * 1.7;
}

// Half bent: knuckle stays up, only distal phalanges fold in
export function isFingerHalfBent(lm, tipIdx) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  const d = dist(lm[tipIdx], lm[0]) / handSize;
  return d > 1.1 && d < 1.6;
}

// Fully curled: tip close to wrist
export function isFingerCurled(lm, tipIdx) {
  const handSize = dist(lm[0], lm[9]);
  return handSize > 0.01 && dist(lm[tipIdx], lm[0]) < handSize * 1.4;
}

// Euclidean distance between two normalized landmarks
export function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Returns true if the hand is showing a thumbs-down gesture.
 * Used as a UI cancel control — not an ability.
 * Checked separately from ability detection in GameCanvas.
 *
 * @param {Array<{x,y,z}>} landmarks - 21 hand landmarks
 * @returns {boolean}
 */
export function detectThumbsDown(landmarks) {
  if (!landmarks || landmarks.length < 21) return false;
  const handSize = dist(landmarks[0], landmarks[9]);
  if (handSize < 0.01) return false;
  const tips = [8, 12, 16, 20];
  const closedCount = tips.filter(i => dist(landmarks[i], landmarks[0]) < handSize * 1.6).length;
  return closedCount >= 3 && landmarks[4].y > landmarks[0].y + handSize * 0.9;
}
