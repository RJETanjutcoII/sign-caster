'use client';

import { ABILITIES } from '@/lib/abilities';
import AbilityDisplay from './AbilityDisplay';
import LoadoutHUD from './LoadoutHUD';
import StatsHUD from './StatsHUD';
import dynamic from 'next/dynamic';
const DomainLayer = dynamic(() => import('./DomainLayer'), { ssr: false });

/**
 * Shared battle UI for BotCanvas and PvPCanvas.
 * Pure rendering — no game logic.
 */
export default function MultiUI({
  // overlays
  status, gamePhase, gameOver, onBack,
  // player pane
  videoRef, canvasRef, showLandmarks, onToggleLandmarks,
  playerState, loadout, currentGesture, activeEffect,
  // video effects
  playerVideoEffect, compositeCanvasRef, backgroundActive, fps,
  // opponent pane
  opponentState, opponentLoadout, opponentLabel, opponentIcon, opponentVideoRef,
  // timer
  turnKey, confirmedGesture, resolveMessage, onCancelMove,
}) {
  return (
    <div className="battle-root">
      {status && <div className="status-overlay">{status}</div>}
      {gamePhase === 'warmup' && !status && (
        <div className="warmup-overlay">
          <span className="warmup-text">Show your hands to begin</span>
        </div>
      )}

      {/* ── Left pane — player ── */}
      <div className="battle-pane battle-pane--player">
        {/* Raw camera feed — hidden when background replacement is active */}
        <video
          ref={videoRef}
          className={showLandmarks ? 'game-video' : 'game-video game-video--visible'}
          style={backgroundActive ? { display: 'none' } : {}}
          playsInline
          muted
        />
        {/* Composited canvas (person over background MP4) — shown during domains */}
        {compositeCanvasRef && (
          <canvas
            ref={compositeCanvasRef}
            className="game-video game-video--visible"
            style={backgroundActive ? {} : { display: 'none' }}
          />
        )}
        <canvas ref={canvasRef} className="game-canvas" style={showLandmarks ? {} : { display: 'none' }} />

        {/* Overlay video effect (plays in front of the camera) */}
        {playerVideoEffect?.type === 'overlay' && (
          <video
            key={playerVideoEffect.src}
            className="camera-effect-overlay"
            src={playerVideoEffect.src}
            autoPlay
            muted
            loop={playerVideoEffect.loop ?? false}
            onError={() => {}}
          />
        )}

        <DomainLayer activeDomain={playerState?.activeDomain} />
        {activeEffect && (() => { const E = activeEffect; return <E />; })()}
        {playerState?.multiTurnActive && (() => {
          const L = ABILITIES[playerState.multiTurnActive.abilityKey]?.LoopEffect;
          return L ? <L /> : null;
        })()}
        {playerState?.activeDomain && (() => {
          const L = ABILITIES[playerState.activeDomain.abilityKey]?.LoopEffect;
          return L ? <L /> : null;
        })()}

        <StatsHUD state={playerState} />
        <AbilityDisplay gesture={currentGesture} loadout={loadout} />
        <LoadoutHUD loadout={loadout} />

        <button className="landmark-toggle-btn" onClick={onToggleLandmarks}>
          {showLandmarks ? '📷 Camera' : '✋ Landmarks'}
        </button>
        {fps > 0 && <div className="fps-badge">{fps} fps</div>}
      </div>

      {/* ── Right pane — opponent ── */}
      <div className="battle-pane battle-pane--opponent">
        {opponentVideoRef
          ? <video ref={opponentVideoRef} className="game-video game-video--visible game-video--opponent" playsInline muted={false} autoPlay />
          : (
            <div className="opponent-avatar">
              <span className="opponent-avatar-icon">{opponentIcon}</span>
              <span className="opponent-avatar-label">{opponentLabel}</span>
            </div>
          )
        }
        <StatsHUD state={opponentState} />
        <LoadoutHUD loadout={opponentLoadout} />
      </div>

      {/* ── Shared turn timer — centered over both panes ── */}
      <div className="battle-timer">
        <div className="turn-timer-label">
          {gamePhase === 'selecting'
            ? (playerState?.multiTurnActive
                ? `Charging ${ABILITIES[playerState.multiTurnActive.abilityKey]?.name}`
                : confirmedGesture
                  ? `READY: ${ABILITIES[confirmedGesture]?.name}`
                  : 'SELECT YOUR MOVE')
            : (resolveMessage ?? 'NO MOVE')}
        </div>
        <div className="turn-timer-track">
          {gamePhase === 'selecting' && <div key={turnKey} className="turn-timer-fill" />}
        </div>
        {gamePhase === 'selecting' && confirmedGesture && !playerState?.multiTurnActive && (
          <button className="cancel-move-btn" onClick={onCancelMove}>✕ Cancel move</button>
        )}
      </div>

      {/* ── Back button ── */}
      <button className="back-button" onClick={onBack}>← Loadout</button>

      {/* ── Game over overlay ── */}
      {gameOver && (
        <div className="gameover-overlay">
          <span className={`gameover-text ${gameOver === 'win' ? 'gameover-text--win' : 'gameover-text--loss'}`}>
            {gameOver === 'win' ? 'VICTORY' : 'DEFEAT'}
          </span>
          <button className="gameover-btn" onClick={onBack}>← Back to Menu</button>
        </div>
      )}
    </div>
  );
}
