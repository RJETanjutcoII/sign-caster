'use client';

import { useRef, useState, useEffect } from 'react';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

/**
 * Establishes a WebRTC peer connection for opponent camera feed.
 *
 * p1 = offerer (creates the offer first)
 * p2 = answerer
 *
 * Signaling is relayed through the existing WebSocket (mp.sendSignal / mp.setOnSignal).
 */
export function useWebRTC({ mp, playerId, localVideoRef, enabled }) {
  const pcRef = useRef(null);
  const [opponentStream, setOpponentStream] = useState(null);

  useEffect(() => {
    if (!enabled || !playerId || !mp) return;

    let stopped = false;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;

    // When remote track arrives, expose as opponentStream
    pc.ontrack = (evt) => {
      if (stopped) return;
      setOpponentStream(evt.streams[0] ?? new MediaStream([evt.track]));
    };

    // Relay ICE candidates through WebSocket
    pc.onicecandidate = (evt) => {
      if (evt.candidate) mp.sendSignal({ type: 'ice', candidate: evt.candidate });
    };

    // Add local camera tracks once available
    function addLocalTracks() {
      const stream = localVideoRef?.current?.srcObject;
      if (!stream) return false;
      for (const track of stream.getTracks()) {
        if (!pc.getSenders().find(s => s.track === track)) {
          pc.addTrack(track, stream);
        }
      }
      return true;
    }

    // Poll until the local stream is ready (useGestureEngine sets it asynchronously)
    let trackInterval = setInterval(() => {
      if (stopped) { clearInterval(trackInterval); return; }
      if (addLocalTracks()) clearInterval(trackInterval);
    }, 200);

    // Handle incoming signals
    mp.setOnSignal(async (signal) => {
      if (stopped) return;
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        mp.sendSignal({ type: 'answer', sdp: pc.localDescription });
      }
      if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      }
      if (signal.type === 'ice' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
      }
    });

    // p1 initiates the offer once tracks are ready
    if (playerId === 'p1') {
      const offerInterval = setInterval(async () => {
        if (stopped) { clearInterval(offerInterval); return; }
        if (!addLocalTracks()) return; // wait for tracks
        clearInterval(offerInterval);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        mp.sendSignal({ type: 'offer', sdp: pc.localDescription });
      }, 300);
    }

    return () => {
      stopped = true;
      clearInterval(trackInterval);
      pc.close();
      pcRef.current = null;
      mp.setOnSignal(null);
      setOpponentStream(null);
    };
  }, [enabled, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { opponentStream };
}
