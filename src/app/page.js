'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ModeSelect from '@/components/ModeSelect';
import CameraCheck from '@/components/CameraCheck';
import StatBuilder from '@/components/StatBuilder';
import LoadoutSelect from '@/components/LoadoutSelect';
import Lobby from '@/components/Lobby';
import { useMultiplayer } from '@/lib/useMultiplayer';

const TrainingCanvas = dynamic(() => import('@/components/TrainingCanvas'), {
  ssr: false,
  loading: () => <div className="status-overlay">Loading game...</div>,
});

const BotCanvas = dynamic(() => import('@/components/BotCanvas'), {
  ssr: false,
  loading: () => <div className="status-overlay">Loading game...</div>,
});

const PvPCanvas = dynamic(() => import('@/components/PvPCanvas'), {
  ssr: false,
  loading: () => <div className="status-overlay">Loading game...</div>,
});

export default function Home() {
  const [mode,        setMode]        = useState(null);   // null | 'training' | 'bot' | 'pvp'
  const [cameraReady, setCameraReady] = useState(false);
  const [build,       setBuild]       = useState(null);
  const [loadout,     setLoadout]     = useState(null);
  const [pvpSession,  setPvpSession]  = useState(null);  // { opponentLoadout, opponentBuild, playerId }

  const mp = useMultiplayer();

  if (!mode) {
    return (
      <ModeSelect
        onTraining={() => setMode('training')}
        onBot={()      => setMode('bot')}
        onPvP={()      => setMode('pvp')}
      />
    );
  }

  if (!cameraReady) {
    return <CameraCheck onReady={() => setCameraReady(true)} onBack={() => setMode(null)} />;
  }

  if (!build) {
    return <StatBuilder onConfirm={setBuild} onBack={() => { setCameraReady(false); setMode(null); }} />;
  }

  if (!loadout) {
    return <LoadoutSelect onStart={setLoadout} onBack={() => setBuild(null)} />;
  }

  // PvP: show lobby before canvas
  if (mode === 'pvp' && !pvpSession) {
    return (
      <Lobby
        mp={mp}
        loadout={loadout}
        build={build}
        onReady={setPvpSession}
        onBack={() => { mp.reset(); setLoadout(null); }}
      />
    );
  }

  if (mode === 'training') {
    return <TrainingCanvas loadout={loadout} build={build} onBack={() => setLoadout(null)} />;
  }

  if (mode === 'pvp') {
    return (
      <PvPCanvas
        loadout={loadout}
        build={build}
        opponentLoadout={pvpSession.opponentLoadout}
        opponentBuild={pvpSession.opponentBuild}
        playerId={pvpSession.playerId}
        mp={mp}
        onBack={() => { mp.reset(); setPvpSession(null); setLoadout(null); }}
      />
    );
  }

  return <BotCanvas loadout={loadout} build={build} onBack={() => setLoadout(null)} />;
}
