export default {
  name: 'Iron Wall', category: 'support', color: '#88aaff',
  manaCost: 8, ultCost: 0, ultGain: 1,
  gesture: 'Cross both forearms in front of your chest',
  gestureType: 'two-hand',
  detect(hands, face, handedness) {
    if (hands.length < 2 || !handedness || handedness.length < 2) return false;
    const leftIdx  = handedness.findIndex(h => h[0]?.categoryName === 'Left');
    const rightIdx = handedness.findIndex(h => h[0]?.categoryName === 'Right');
    if (leftIdx < 0 || rightIdx < 0) return false;
    // In a mirrored camera the physical left hand appears on screen-right (higher x).
    // Crossed arms means the left hand is now on screen-left (lower x) — inverted.
    return hands[leftIdx][0].x < hands[rightIdx][0].x;
  },
  resolve() { return { defBuff: { delta: 9, turnsLeft: 2 } }; },
};
