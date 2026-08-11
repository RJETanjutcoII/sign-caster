import { dist } from '@/lib/gestures';

function isFist(lm) {
  const handSize = dist(lm[0], lm[9]);
  if (handSize < 0.01) return false;
  const tips = [8, 12, 16, 20];
  return tips.filter(i => dist(lm[i], lm[0]) < handSize * 1.6).length >= 3;
}

export default {
  name: 'Summon Mahoraga', category: 'ultimate', color: '#a0c8ff',
  manaCost: 0, ultCost: 5, ultGain: 0,
  gesture: 'Both closed fists held close together',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    return isFist(lm0) && isFist(lm1) && dist(lm0[0], lm1[0]) < 0.55;
  },
  resolve() { return {}; },
};
