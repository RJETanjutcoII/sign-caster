import { dist } from '@/lib/gestures';

// Shared sphere style — 200vw circle positioned so only the bottom arc is visible at top ~10vh
const SPHERE_BASE = `
  position: fixed;
  left: 50%;
  top: 0;
  width: 200vw;
  height: 200vw;
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle at 50% 50%,
    rgba(255,255,235,1)   0%,
    rgba(220,242,255,0.95) 18%,
    rgba(170,215,255,0.75) 42%,
    rgba(110,185,255,0.3)  65%,
    transparent            80%
  );
  box-shadow:
    0 0 140px 100px rgba(180,225,255,0.45),
    0 0  60px  40px rgba(255,255,200,0.55);
`;

// Effect 1 — formation: sphere rises into position from above, stays at full opacity
export const ChargeEffect = () => (
  <>
    <style>{`
      @keyframes fx-sb-form {
        0%   { opacity: 0;   transform: translateX(-50%) translateY(calc(-100% - 8vh)) scale(0.25); filter: blur(40px); }
        55%  { opacity: 0.9; transform: translateX(-50%) translateY(calc(-100% + 8vh))  scale(0.9);  filter: blur(6px);  }
        100% { opacity: 1;   transform: translateX(-50%) translateY(calc(-100% + 10vh)) scale(1);    filter: blur(3px);  }
      }
      @keyframes fx-sb-form-ambient {
        0%   { opacity: 0; }
        100% { opacity: 1; }
      }
      .fx-sb-form-sphere {
        ${SPHERE_BASE}
        animation: fx-sb-form 1.4s cubic-bezier(0.2,0.8,0.4,1) forwards;
      }
      .fx-sb-form-ambient {
        position: fixed; inset: 0; pointer-events: none;
        background: linear-gradient(to bottom, rgba(180,220,255,0.25) 0%, transparent 25%);
        animation: fx-sb-form-ambient 1.4s ease-out forwards;
      }
    `}</style>
    <div className="fx-sb-form-sphere" />
    <div className="fx-sb-form-ambient" />
  </>
);

// Effect 2 — charging loop: sphere hovers overhead with a slow breathing pulse
export const LoopEffect = () => (
  <>
    <style>{`
      @keyframes fx-sb-pulse {
        0%   { transform: translateX(-50%) translateY(calc(-100% + 10vh))   scale(1);     filter: blur(3px); opacity: 1;   }
        50%  { transform: translateX(-50%) translateY(calc(-100% + 10.8vh)) scale(1.012); filter: blur(4px); opacity: 0.9; }
        100% { transform: translateX(-50%) translateY(calc(-100% + 10vh))   scale(1);     filter: blur(3px); opacity: 1;   }
      }
      .fx-sb-loop-sphere {
        ${SPHERE_BASE}
        animation: fx-sb-pulse 2.2s ease-in-out infinite;
      }
      .fx-sb-loop-ambient {
        position: fixed; inset: 0; pointer-events: none;
        background: linear-gradient(to bottom, rgba(180,220,255,0.25) 0%, transparent 25%);
      }
    `}</style>
    <div className="fx-sb-loop-sphere" />
    <div className="fx-sb-loop-ambient" />
  </>
);

// Effect 3 — launch: sphere drops from hover position downward through the screen
export const Effect = () => (
  <>
    <style>{`
      @keyframes fx-sb-drop {
        0%   { opacity: 1;   transform: translateX(-50%) translateY(calc(-100% + 10vh))  scale(1);   filter: blur(3px); }
        25%  { opacity: 1;   transform: translateX(-50%) translateY(calc(-100% + 45vh))  scale(1.1); filter: blur(1px); }
        65%  { opacity: 0.9; transform: translateX(-50%) translateY(calc(-100% + 100vh)) scale(1.3); filter: blur(0);   }
        100% { opacity: 0;   transform: translateX(-50%) translateY(calc(-100% + 180vh)) scale(1.8); filter: blur(12px);}
      }
      @keyframes fx-sb-flash {
        0%   { opacity: 0; }
        60%  { opacity: 0; }
        75%  { opacity: 0.75; }
        100% { opacity: 0; }
      }
      .fx-sb-launch-sphere {
        ${SPHERE_BASE}
        animation: fx-sb-drop 2s cubic-bezier(0.4,0,1,1) forwards;
      }
      .fx-sb-launch-ambient {
        position: fixed; inset: 0; pointer-events: none;
        background: linear-gradient(to bottom, rgba(180,220,255,0.25) 0%, transparent 25%);
      }
      .fx-sb-flash {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(215,238,255,0.9);
        animation: fx-sb-flash 2s ease-out forwards;
      }
    `}</style>
    <div className="fx-sb-launch-sphere" />
    <div className="fx-sb-launch-ambient" />
    <div className="fx-sb-flash" />
  </>
);

export default {
  name: 'Spirit Bomb', category: 'ultimate', color: '#ffffaa',
  manaCost: 0, ultCost: 5, ultGain: 0,
  turnType: 'multi', turnAmount: 2,
  gesture: 'Both open palms, arms spread wide',
  gestureType: 'two-hand',
  detect(hands) {
    const [lm0, lm1] = hands;
    if (!lm0 || !lm1) return false;
    function isOpenPalm(lm) {
      const handSize = dist(lm[0], lm[9]);
      if (handSize < 0.01) return false;
      return [8, 12, 16, 20].filter(i => dist(lm[i], lm[0]) > handSize * 1.5).length >= 3;
    }
    return isOpenPalm(lm0) && isOpenPalm(lm1) && dist(lm0[0], lm1[0]) > 0.45;
  },
  ChargeEffect,
  LoopEffect,
  Effect,
  resolve() { return { damage: 50 }; },
};
