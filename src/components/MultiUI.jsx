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
  // opponent domain (bot canvas only — each PvP client renders its own)
  opponentActiveDomain,
  // background video to show in the opponent pane (domain active)
  opponentBackground,
  // opponent compositing (PvP only — Zoom-style background replacement)
  opponentCompositeCanvasRef,
  opponentBackgroundActive,
  // domain clash
  clashScores, clashRound, clashPromptGesture, clashWinner,
  clashPlayerDomain, clashOppDomain,
}) {
  const isClashPhase = gamePhase === 'clash_resolve_entry' ||
                       gamePhase === 'clash_resolve_duel'  ||
                       gamePhase === 'clash_resolve_break' ||
                       gamePhase === 'clash_resolve_exit';
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
        {opponentActiveDomain && (() => {
          const L = ABILITIES[opponentActiveDomain.abilityKey]?.LoopEffect;
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
        {/* Raw WebRTC feed — hidden when compositing is active */}
        {opponentVideoRef && (
          <video
            ref={opponentVideoRef}
            className="game-video game-video--visible game-video--opponent"
            playsInline muted={false} autoPlay
            style={opponentBackgroundActive ? { display: 'none' } : undefined}
          />
        )}
        {/* Composited canvas — opponent person over domain background (PvP) */}
        {opponentCompositeCanvasRef && (
          <canvas
            ref={opponentCompositeCanvasRef}
            className="game-video game-video--visible"
            style={opponentBackgroundActive ? {} : { display: 'none' }}
          />
        )}
        {/* Bot / no-camera fallback */}
        {!opponentVideoRef && !opponentBackground && (
          <div className="opponent-avatar">
            <span className="opponent-avatar-icon">{opponentIcon}</span>
            <span className="opponent-avatar-label">{opponentLabel}</span>
          </div>
        )}
        {/* Background overlay for bot pane (no real camera — composite not available) */}
        {opponentBackground?.src && !opponentCompositeCanvasRef && (
          <video
            key={opponentBackground.src}
            className="opponent-bg-video"
            src={opponentBackground.src}
            autoPlay muted loop={opponentBackground.loop ?? false}
            onError={() => {}}
          />
        )}
        <StatsHUD state={opponentState} />
        <LoadoutHUD loadout={opponentLoadout} />
      </div>

      {/* ── Shared turn timer — centered over both panes ── */}
      {!isClashPhase && (
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
      )}

      {/* ── Domain clash overlay ── */}
      {gamePhase === 'clash_resolve_entry' && (
        <div className="clash-overlay clash-overlay--entry">
          <div className="clash-title">DOMAIN CLASH</div>
          <div className="clash-versus">
            {ABILITIES[clashPlayerDomain]?.name ?? '???'} vs {ABILITIES[clashOppDomain]?.name ?? '???'}
          </div>
          <div className="clash-subtitle">Domains expanding...</div>
        </div>
      )}

      {gamePhase === 'clash_resolve_duel' && (
        <div className="clash-overlay clash-overlay--duel">
          <div className="clash-scores">
            <span className="clash-score-you">
              {'● '.repeat(clashScores?.player ?? 0)}{'○ '.repeat(3 - (clashScores?.player ?? 0))}
              YOU
            </span>
            <span className="clash-round">Round {clashRound}</span>
            <span className="clash-score-opp">
              OPP
              {'● '.repeat(clashScores?.opponent ?? 0)}{'○ '.repeat(3 - (clashScores?.opponent ?? 0))}
            </span>
          </div>
          <div className="clash-prompt-label">Make this gesture:</div>
          <div className="clash-prompt-gesture">
            {ABILITIES[clashPromptGesture]?.name ?? clashPromptGesture ?? '...'}
          </div>
        </div>
      )}

      {gamePhase === 'clash_resolve_exit' && (
        <div className="clash-overlay clash-overlay--exit">
          <div className={`clash-result-text ${clashWinner === 'player' ? 'clash-result--win' : 'clash-result--loss'}`}>
            {clashWinner === 'player'
              ? `${ABILITIES[clashPlayerDomain]?.name ?? 'Your domain'} takes hold`
              : `${ABILITIES[clashOppDomain]?.name ?? "Opponent's domain"} takes hold`}
          </div>
        </div>
      )}

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
