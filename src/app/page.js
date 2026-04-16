'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import ModeSelect from '@/components/ModeSelect';
import CameraCheck from '@/components/CameraCheck';
import StatBuilder from '@/components/StatBuilder';
import LoadoutSelect from '@/components/LoadoutSelect';
import Lobby from '@/components/Lobby';
import AuthScreen from '@/components/AuthScreen';
import UsernameSetup from '@/components/UsernameSetup';
import ProfileScreen from '@/components/ProfileScreen';
import { useMultiplayer } from '@/lib/useMultiplayer';
import { useAuth } from '@/lib/useAuth';
import { computeBuildFromPoints } from '@/lib/buildUtils';

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

// Resets all in-game state back to the main menu.
function useGameStateReset(setters) {
  return function goHome() {
    setters.setMode(null);
    setters.setCameraReady(false);
    setters.setBuild(null);
    setters.setLoadout(null);
    setters.setPoints(null);
    setters.setPvpSession(null);
  };
}

export default function Home() {
  const { user, profile, savedConfig, authLoading,
          signInWithGoogle, signOut, setUsername,
          saveConfig, recordBattleResult } = useAuth();

  const [mode,        setMode]        = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [build,       setBuild]       = useState(null);
  const [loadout,     setLoadout]     = useState(null);
  const [points,      setPoints]      = useState(null);
  const [pvpSession,  setPvpSession]  = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [editSetup,   setEditSetup]   = useState(null); // 'build' | 'loadout' | null

  const mp = useMultiplayer();

  const goHome = useGameStateReset({ setMode, setCameraReady, setBuild, setLoadout, setPoints, setPvpSession });

  // ── Auth loading ───────────────────────────────────────────────────────────
  if (authLoading) {
    return <div className="status-overlay">Loading…</div>;
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!user) {
    return <AuthScreen onSignIn={signInWithGoogle} />;
  }

  // ── Signed in but no username yet (first login) ────────────────────────────
  if (!profile?.username) {
    return <UsernameSetup onConfirm={setUsername} />;
  }

  // ── Profile screen ─────────────────────────────────────────────────────────
  if (showProfile) {
    return (
      <ProfileScreen
        profile={profile}
        onBack={() => setShowProfile(false)}
        onSignOut={signOut}
        onChangeSetup={() => setShowProfile(false)}
      />
    );
  }

  // ── Standalone build edit (from main menu, no battle) ─────────────────────
  if (editSetup === 'build') {
    return (
      <StatBuilder
        initialPoints={points ?? savedConfig?.points}
        onConfirm={(newBuild, newPoints) => {
          setBuild(newBuild);
          setPoints(newPoints);
          // Save with existing loadout preserved
          saveConfig(newPoints, loadout ? [...loadout] : (savedConfig?.loadout ?? []));
          setEditSetup(null);
        }}
        onBack={() => setEditSetup(null)}
      />
    );
  }

  // ── Standalone loadout edit (from main menu, no battle) ───────────────────
  if (editSetup === 'loadout') {
    return (
      <LoadoutSelect
        initialSlots={loadout ? [...loadout] : (savedConfig?.loadout ?? [])}
        onStart={(newLoadout) => {
          setLoadout(newLoadout);
          saveConfig(points ?? savedConfig?.points ?? { hp: 0, atk: 0, def: 0, spd: 0, mp: 0 }, [...newLoadout]);
          setEditSetup(null);
        }}
        onBack={() => setEditSetup(null)}
      />
    );
  }

  // ── Mode select ────────────────────────────────────────────────────────────
  if (!mode) {
    function handleModeSelect(selectedMode) {
      // Auto-restore saved config so user skips StatBuilder + LoadoutSelect
      if (savedConfig && !build) {
        setPoints(savedConfig.points);
        setBuild(computeBuildFromPoints(savedConfig.points));
        setLoadout(new Set(savedConfig.loadout));
      }
      setMode(selectedMode);
    }

    return (
      <ModeSelect
        onTraining={() => handleModeSelect('training')}
        onBot={()      => handleModeSelect('bot')}
        onPvP={()      => handleModeSelect('pvp')}
        onProfile={() => setShowProfile(true)}
        onEditBuild={() => setEditSetup('build')}
        onEditLoadout={() => setEditSetup('loadout')}
        hasSavedConfig={!!savedConfig}
      />
    );
  }

  // ── Camera check ───────────────────────────────────────────────────────────
  if (!cameraReady) {
    return <CameraCheck onReady={() => setCameraReady(true)} onBack={() => { goHome(); }} />;
  }

  // ── Stat builder (only reached when no saved config exists) ───────────────
  if (!build) {
    return (
      <StatBuilder
        initialPoints={points ?? savedConfig?.points}
        onConfirm={(newBuild, newPoints) => {
          setBuild(newBuild);
          setPoints(newPoints);
        }}
        onBack={goHome}
      />
    );
  }

  // ── Loadout select (only reached when no saved config exists) ─────────────
  if (!loadout) {
    return (
      <LoadoutSelect
        initialSlots={savedConfig?.loadout ?? []}
        onStart={(newLoadout) => {
          setLoadout(newLoadout);
          saveConfig(points, [...newLoadout]);
        }}
        onBack={goHome}
      />
    );
  }

  // ── PvP lobby ──────────────────────────────────────────────────────────────
  if (mode === 'pvp' && !pvpSession) {
    return (
      <Lobby
        mp={mp}
        loadout={loadout}
        build={build}
        username={profile.username}
        onReady={setPvpSession}
        onBack={() => { mp.reset(); goHome(); }}
      />
    );
  }

  // ── Training canvas ────────────────────────────────────────────────────────
  if (mode === 'training') {
    return <TrainingCanvas loadout={loadout} build={build} onBack={goHome} />;
  }

  // ── PvP canvas ─────────────────────────────────────────────────────────────
  if (mode === 'pvp') {
    return (
      <PvPCanvas
        loadout={loadout}
        build={build}
        opponentLoadout={pvpSession.opponentLoadout}
        opponentBuild={pvpSession.opponentBuild}
        playerId={pvpSession.playerId}
        mp={mp}
        onBack={() => { mp.reset(); goHome(); }}
        onBattleEnd={(result) =>
          recordBattleResult(result, 'pvp', pvpSession.opponentUsername ?? 'Unknown', points, [...loadout])
        }
      />
    );
  }

  // ── Bot canvas ─────────────────────────────────────────────────────────────
  return (
    <BotCanvas
      loadout={loadout}
      build={build}
      onBack={goHome}
      onBattleEnd={(result) =>
        recordBattleResult(result, 'bot', null, points, [...loadout])
      }
    />
  );
}
