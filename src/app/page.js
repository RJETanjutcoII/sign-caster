'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ModeSelect from '@/components/ModeSelect';
import CameraCheck from '@/components/CameraCheck';
import LoadoutSelect from '@/components/LoadoutSelect';

const TrainingCanvas = dynamic(() => import('@/components/TrainingCanvas'), {
  ssr: false,
  loading: () => <div className="status-overlay">Loading game...</div>,
});

const BotCanvas = dynamic(() => import('@/components/BotCanvas'), {
  ssr: false,
  loading: () => <div className="status-overlay">Loading game...</div>,
});

export default function Home() {
  const [mode,         setMode]         = useState(null);  // null | 'training' | 'bot'
  const [cameraReady,  setCameraReady]  = useState(false);
  const [loadout,      setLoadout]      = useState(null);

  if (!mode) {
    return <ModeSelect onTraining={() => setMode('training')} onBot={() => setMode('bot')} />;
  }

  if (!cameraReady) {
    return <CameraCheck onReady={() => setCameraReady(true)} onBack={() => setMode(null)} />;
  }

  if (!loadout) {
    return <LoadoutSelect onStart={setLoadout} onBack={() => { setCameraReady(false); setMode(null); }} />;
  }

  if (mode === 'training') {
    return <TrainingCanvas loadout={loadout} onBack={() => setLoadout(null)} />;
  }

  return <BotCanvas loadout={loadout} onBack={() => setLoadout(null)} />;
}
