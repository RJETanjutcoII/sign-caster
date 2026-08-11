import { dist, isFingerExtended, isFingerCurled } from '@/lib/gestures';

export default {
  name: 'Web Shot', category: 'support', color: '#aaccff',
  manaCost: 5, ultCost: 0, ultGain: 1,
  gesture: 'Spider-Man: thumb, index, and pinky extended; middle and ring curled',
  gestureType: 'single',
  detect(hands) {
    const lm = hands[0];
    if (!lm) return false;
    const handSize = dist(lm[0], lm[9]);
    if (handSize < 0.01) return false;
    // Spider-Man pose: index and pinky point outward (not straight up), so use
    // looser 1.5× threshold rather than isFingerExtended's strict 1.7×
    const indexExtended = dist(lm[8],  lm[0]) > handSize * 1.5;
    const pinkyExtended = dist(lm[20], lm[0]) > handSize * 1.4;
    const middleCurled  = isFingerCurled(lm, 12);
    const ringCurled    = isFingerCurled(lm, 16);
    const thumbOut      = dist(lm[4],  lm[0]) > handSize * 1.2;
    return indexExtended && pinkyExtended && middleCurled && ringCurled && thumbOut;
  },
  resolve() { return { speedReduction: 1 }; },
};
