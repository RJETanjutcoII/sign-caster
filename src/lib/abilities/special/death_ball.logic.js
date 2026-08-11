import { isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Death Ball', category: 'special', color: '#bb44ff',
  manaCost: 5, ultCost: 0, ultGain: 2,
  gesture: 'Index finger pointed upward, others curled',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    if (!isFingerExtended(lm, 8))  return false;
    if (!isFingerCurled(lm,   12)) return false;
    if (!isFingerCurled(lm,   16)) return false;
    if (!isFingerCurled(lm,   20)) return false;
    // Finger must be pointing upward — vertical component > horizontal
    const dy = lm[5].y - lm[8].y; // positive = tip above MCP knuckle
    const dx = Math.abs(lm[8].x - lm[5].x);
    return dy > dx;
  },
  resolve() { return { damage: 30 }; },
};
