import { isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Shot', category: 'basic', color: '#ff8844',
  manaCost: 0, ultCost: 0, ultGain: 1,
  gesture: 'Index out, thumb up, other fingers curled',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const indexExtended = isFingerExtended(lm, 8);
    const thumbUp       = lm[4].y < lm[5].y;
    const middleCurled  = isFingerCurled(lm, 12);
    const ringCurled    = isFingerCurled(lm, 16);
    const pinkyCurled   = isFingerCurled(lm, 20);
    return indexExtended && thumbUp && middleCurled && ringCurled && pinkyCurled;
  },
  resolve() { return { damage: 15 }; },
};
