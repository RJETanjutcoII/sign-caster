import { dist } from '@/lib/gestures';

function isFingerGun(lm) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  const indexExtended = dist(lm[8],  lm[0]) > handSize * 1.5;
  const middleCurled  = dist(lm[12], lm[0]) < handSize * 1.4;
  const ringCurled    = dist(lm[16], lm[0]) < handSize * 1.4;
  const pinkyCurled   = dist(lm[20], lm[0]) < handSize * 1.4;
  return indexExtended && middleCurled && ringCurled && pinkyCurled;
}

export default {
  name: 'Expose', category: 'support', color: '#ff6688',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Both hands in finger-gun pose',
  gestureType: 'two-hand',
  detect(hands) {
    if (hands.length < 2) return false;
    return isFingerGun(hands[0]) && isFingerGun(hands[1]);
  },
  resolve() { return { defDebuff: { amount: 6, turns: 2 } }; },
};
