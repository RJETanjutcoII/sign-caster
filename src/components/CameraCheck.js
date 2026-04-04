'use client';
import { useEffect, useRef, useState } from 'react';

export default function CameraCheck({ onReady, onBack }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('checking'); // 'checking' | 'ready' | 'denied'

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setStatus('ready');
      })
      .catch(() => setStatus('denied'));

    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

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
