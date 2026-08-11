import { isFingerExtended, isFingerCurled, dist } from '@/lib/gestures';

function isPeaceSign(lm) {
  if (!lm) return false;
  const indexExtended  = isFingerExtended(lm, 8);
  const middleExtended = isFingerExtended(lm, 12);
  const ringCurled     = isFingerCurled(lm, 16);
  const pinkyCurled    = isFingerCurled(lm, 20);
  if (!indexExtended || !middleExtended || !ringCurled || !pinkyCurled) return false;
  // Fingers must be spread (not IT pose)
  const handWidth  = Math.abs(lm[5].x - lm[17].x);
  const fingerGap  = Math.abs(lm[8].x  - lm[12].x);
  return handWidth <= 0 || fingerGap / handWidth >= 0.3;
}

export default {
  name: 'Double V', category: 'support', color: '#88eeff',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Peace sign with both hands',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isPeaceSign(lm0) && isPeaceSign(lm1) && dist(lm0[0], lm1[0]) < 0.8;
  },
  resolve() { return { speedBoost: 1 }; },
};
