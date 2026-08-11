import { dist } from '@/lib/gestures';

export default {
  name: 'Strike', category: 'basic', color: '#ff4444',
  manaCost: 0, ultCost: 0, ultGain: 1,
  gesture: 'Closed fist',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    const tips = [8, 12, 16, 20];
    const closedCount = tips.filter(i => dist(lm[i], lm[0]) < handSize * 1.6).length;
    if (closedCount < 3) return false;
    const thumbHighAboveWrist = lm[4].y < lm[0].y - handSize * 0.9;
    return !thumbHighAboveWrist;
  },
  resolve() { return { damage: 15 }; },
};
