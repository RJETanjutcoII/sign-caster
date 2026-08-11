'use client';
import { useEffect, useRef, useState } from 'react';

export default function CameraCheck({ onReady, onBack }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'denied'

  useEffect(() => {
    let stopped   = false;
    let ownStream = null;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        // React Strict Mode runs this effect's mount/cleanup/mount cycle
        // synchronously in dev, before this promise resolves. If cleanup
        // already fired, this is the orphaned first call — release it
        // immediately instead of leaving two concurrent opens on the same
        // camera (which on many Windows webcam drivers yields a black/frozen
        // frame on one of the two streams).
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        ownStream = stream;
        streamRef.current = stream;
        setStatus('ready');
      })
      .catch(() => { if (!stopped) setStatus('denied'); });

    return () => {
      stopped = true;
      ownStream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // The <video> element only mounts once status flips to 'ready', so the
  // stream must be attached here (after that render), not inside the
  // getUserMedia callback above where videoRef.current is still null.
  useEffect(() => {
    if (status === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [status]);

  return (
    <div className="camera-check">
      <h2 className="camera-check-title">Camera Check</h2>

      {status === 'checking' && (
        <p className="camera-check-msg">Checking camera access...</p>
      )}

      {status === 'ready' && (
        <>
          <video ref={videoRef} className="camera-check-preview" muted playsInline />
          <p className="camera-check-msg camera-check-msg--ok">Camera ready</p>
          <button className="loadout-start" onClick={onReady}>Continue →</button>
        </>
      )}

      {status === 'denied' && (
        <p className="camera-check-msg camera-check-msg--err">
          Camera access denied.<br />Allow camera access in your browser and refresh.
        </p>
      )}

      <button className="loadout-back" onClick={onBack}>← Back</button>
    </div>
  );
}
