/**
 * gestures.js
 * Pure functions for detecting hand gestures from MediaPipe landmarks.
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

// Returns true if a finger tip is extended (above its MCP joint in y)
function isFingerExtended(landmarks, tipIdx, mcpIdx) {
  return landmarks[tipIdx].y < landmarks[mcpIdx].y;
}

// Returns true if a finger is curled (tip below its PIP joint in y)
function isFingerCurled(landmarks, tipIdx, pipIdx) {
  return landmarks[tipIdx].y > landmarks[pipIdx].y;
}

// Euclidean distance between two normalized landmarks
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Detects the current gesture from hand landmarks and optional face landmarks.
 *
 * @param {Array<{x,y,z}>} landmarks        - 21 hand landmarks from MediaPipe
 * @param {Array<{x,y,z}>|null} faceLandmarks - 478 face landmarks (or null if no face detected)
 * @returns {'open_palm'|'fist'|'point'|'unlimited_void'|'instant_transmission'|null}
 */
export function detectGesture(landmarks, faceLandmarks = null) {
  if (!landmarks || landmarks.length < 21) return null;

  const indexExtended  = isFingerExtended(landmarks, 8,  5);
  const middleExtended = isFingerExtended(landmarks, 12, 9);

  const middleCurled = isFingerCurled(landmarks, 12, 10);
  const ringCurled   = isFingerCurled(landmarks, 16, 14);
  const pinkyCurled  = isFingerCurled(landmarks, 20, 18);

  // Pressed-fingers shape: index + middle extended and close together, ring + pinky curled.
  // Shared by Gojo's Domain Expansion and Goku's Instant Transmission.
  // We use face landmarks to tell them apart: if the fingertips are near the glabella
  // (between the eyebrows, landmark 9), it's Instant Transmission — otherwise Domain Expansion.
  if (indexExtended && middleExtended && ringCurled && pinkyCurled) {
    const handWidth = Math.abs(landmarks[5].x - landmarks[17].x);
    const fingerGap = Math.abs(landmarks[8].x  - landmarks[12].x);
    const gapRatio  = handWidth > 0 ? fingerGap / handWidth : 1;

    // Only the pressed (not spread) version maps to an ability
    if (gapRatio >= 0.4) return null; // V/peace sign — no ability

    // Check if fingertips are near the forehead (glabella = face landmark 9)
    if (faceLandmarks && faceLandmarks.length > 9) {
      const glabella   = faceLandmarks[9];
      const indexTip   = landmarks[8];
      const middleTip  = landmarks[12];
      const tipToFace  = Math.min(dist(indexTip, glabella), dist(middleTip, glabella));

      if (tipToFace < 0.15) return 'instant_transmission';
    }

    return 'unlimited_void';
  }

  // Finger gun: index extended, thumb raised above the index MCP (knuckle line), rest curled.
  // Using index MCP (5) as the bar — higher than thumb's own MCP so a relaxed point won't qualify.
  const thumbUp = landmarks[4].y < landmarks[5].y;
  if (indexExtended && thumbUp && middleCurled && ringCurled && pinkyCurled) {
    return 'finger_gun';
  }

  // Point: only index extended, rest curled
  if (indexExtended && middleCurled && ringCurled && pinkyCurled) {
    return 'point';
  }

  // Fist: fingertips close to the palm (distance-based, angle-robust)
  {
    const handSize = dist(landmarks[0], landmarks[9]);
    if (handSize > 0.01) {
      const tips = [8, 12, 16, 20];
      const closedCount = tips.filter(i => dist(landmarks[i], landmarks[0]) < handSize * 1.3).length;
      if (closedCount >= 3) return 'fist';
    }
  }

  return null;
}

/**
 * Detects gestures that require both hands simultaneously.
 * Call this before detectGesture when two hands are visible.
 *
 * @param {Array<{x,y,z}>} lm0 - landmarks for hand 0
 * @param {Array<{x,y,z}>} lm1 - landmarks for hand 1
 * @returns {'malevolent_shrine' | 'mahoraga' | null}
 */
export function detectTwoHandGesture(lm0, lm1) {
  if (!lm0 || !lm1) return null;

  // Malevolent Shrine: both hands make the pressed-two-fingers shape
  // (index + middle extended and close together, ring + pinky curled) and
  // are brought close enough that the fingertips nearly meet in the center.
  // This is the steeple/tent pose — wrists stay visible and separate so
  // MediaPipe can track both hands reliably.
  function isPressedShape(lm) {
    // In the steeple pose each hand is angled, so we skip the finger-gap check —
    // the gap ratio is unreliable when the hand is rotated toward the center.
    // Just require index + middle extended, ring + pinky curled.
    return (
      isFingerExtended(lm, 8,  5) &&
      isFingerExtended(lm, 12, 9) &&
      isFingerCurled(lm,   16, 14) &&
      isFingerCurled(lm,   20, 18)
    );
  }

  if (isPressedShape(lm0) && isPressedShape(lm1)) {
    // Wrists within 0.7 — generous threshold to handle angled/steepled hands
    const wristDist = dist(lm0[0], lm1[0]);
    if (wristDist < 0.7) return 'malevolent_shrine';
  }

  // Mahoraga (Ten Shadows): both hands making a fist.
  // Uses distance-based detection instead of y-axis comparison — more robust
  // when fists face the camera (fingers extend toward lens, not downward).
  // A fingertip is "closed" if it's within 1.3× the wrist-to-knuckle distance.
  function isFist(lm) {
    const handSize = dist(lm[0], lm[9]); // wrist → middle MCP
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const closedCount = tips.filter(i => dist(lm[i], lm[0]) < handSize * 1.3).length;
    return closedCount >= 3; // at least 3 of 4 fingertips near the palm
  }

  if (isFist(lm0) && isFist(lm1)) return 'mahoraga';

  return null;
}
