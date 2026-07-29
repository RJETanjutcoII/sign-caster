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
 *
 * When backgroundActive is true, replaceTrack switches the outgoing stream to the
 * compositeCanvas (Zoom-style background already composited in). When false, it switches
 * back to the raw camera. No encoding overhead when no domain is active.
 */
export function useWebRTC({ mp, playerId, localVideoRef, compositeCanvasRef, backgroundActive, enabled }) {
  const pcRef           = useRef(null);
  const canvasStreamRef = useRef(null);
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

    // Add raw camera tracks only — compositeCanvas switching is done via replaceTrack
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

    // ICE candidates can arrive before setRemoteDescription completes — buffer them.
    const iceCandidateQueue = [];
    let remoteDescSet = false;

    async function flushIceCandidates() {
      while (iceCandidateQueue.length) {
        const c = iceCandidateQueue.shift();
        await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
    }

    // Handle incoming signals
    mp.setOnSignal(async (signal) => {
      if (stopped) return;
      try {
        if (signal.type === 'offer') {
          if (typeof signal.sdp?.type !== 'string' || typeof signal.sdp?.sdp !== 'string') return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          remoteDescSet = true;
          await flushIceCandidates();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          mp.sendSignal({ type: 'answer', sdp: pc.localDescription });
        }
        if (signal.type === 'answer') {
          if (typeof signal.sdp?.type !== 'string' || typeof signal.sdp?.sdp !== 'string') return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          remoteDescSet = true;
          await flushIceCandidates();
        }
        if (signal.type === 'ice' && signal.candidate) {
          if (typeof signal.candidate !== 'object' || signal.candidate === null) return;
          if (remoteDescSet) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
          } else {
            iceCandidateQueue.push(signal.candidate);
          }
        }
      } catch {
        // malformed signal — ignore
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
      canvasStreamRef.current?.getTracks().forEach(t => t.stop());
      canvasStreamRef.current = null;
    };
  }, [enabled, playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Switch outgoing video track when background activates / deactivates.
  // captureStream runs only while a domain is active — zero encoding overhead otherwise.
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc) return;
    const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
    if (!videoSender) return;

    if (backgroundActive) {
      const canvas = compositeCanvasRef?.current;
      if (!canvas || canvas.width === 0 || canvas.height === 0) return;
      const stream = canvas.captureStream(30);
      const track = stream.getVideoTracks()[0];
      if (track) {
        videoSender.replaceTrack(track).then(() => {
          canvasStreamRef.current = stream;
        }).catch(() => {
          stream.getTracks().forEach(t => t.stop());
        });
      }
    } else {
      // Switch back to raw camera and free the canvas encoder
      const rawStream = localVideoRef?.current?.srcObject;
      const track = rawStream?.getVideoTracks()[0];
      if (track) videoSender.replaceTrack(track).catch(() => {});
      canvasStreamRef.current?.getTracks().forEach(t => t.stop());
      canvasStreamRef.current = null;
    }
  }, [backgroundActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return { opponentStream };
}
