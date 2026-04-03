'use client';

import { createPortal } from 'react-dom';
import { ABILITIES } from '@/lib/abilities';

export default function DomainLayer({ activeDomain }) {
  if (!activeDomain) return null;
  const L = ABILITIES[activeDomain.abilityKey]?.LoopEffect;
  if (!L) return null;
  return createPortal(<L />, document.body);
}
