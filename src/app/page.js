'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import LoadoutSelect from '@/components/LoadoutSelect';

const GameCanvas = dynamic(() => import('@/components/GameCanvas'), {
  ssr: false,
  loading: () => <div className="status-overlay">Loading game...</div>,
});

export default function Home() {
  const [loadout, setLoadout] = useState(null);

  if (!loadout) {
    return <LoadoutSelect onStart={setLoadout} />;
  }

  return <GameCanvas loadout={loadout} onBack={() => setLoadout(null)} />;
}
