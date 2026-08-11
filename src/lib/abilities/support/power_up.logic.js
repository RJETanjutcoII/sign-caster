import { dist } from '@/lib/gestures';

function isFist(lm) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  return [8, 12, 16, 20].filter(i => dist(lm[i], lm[0]) < handSize * 1.6).length >= 3;
}

export default {
  name: 'Power Up', category: 'support', color: '#ffaa33',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Both fists raised high',
  gestureType: 'two-hand',
  detect(hands) {
    if (hands.length < 2) return false;
    // Both fists, both wrists in upper half of frame (y=0 is top)
    return isFist(hands[0]) && isFist(hands[1])
      && hands[0][0].y < 0.45 && hands[1][0].y < 0.45;
  },
  resolve() { return { atkBuff: { delta: 8, turnsLeft: 2 } }; },
};
