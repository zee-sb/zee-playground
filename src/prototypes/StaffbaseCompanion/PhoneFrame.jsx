import React, { useEffect, useState } from 'react';
import { Wifi } from 'lucide-react';

// Navigator-style iPhone frame (390×760). The chat body is responsible for its
// own purple AppHeader; the frame just provides the bezel + ambient gradient.

export function PhoneFrame({ children }) {
  return (
    <div style={{ position: 'relative', width: 390, flexShrink: 0 }}>
      {/* Side buttons */}
      {[100, 148].map((top) => (
        <div key={top} style={{ position: 'absolute', left: -4, top, width: 4, height: 30, background: '#2A2A2E', borderRadius: '2px 0 0 2px' }} />
      ))}
      <div style={{ position: 'absolute', right: -4, top: 120, width: 4, height: 56, background: '#2A2A2E', borderRadius: '0 2px 2px 0' }} />
      <div
        style={{
          width: 390,
          height: 760,
          background: 'linear-gradient(160deg, #2C2C2E 0%, #1C1C1E 60%)',
          borderRadius: 52,
          padding: 13,
          boxShadow: [
            '0 0 0 1px rgba(255,255,255,0.08)',
            '0 0 0 3px #0A0A0A',
            '0 40px 80px rgba(0,0,0,0.7)',
            '0 20px 40px rgba(0,0,0,0.5)',
            'inset 0 1px 0 rgba(255,255,255,0.1)',
          ].join(', '),
          position: 'relative',
        }}
      >
        {/* Dynamic Island */}
        <div
          style={{
            position: 'absolute', top: 13, left: '50%', transform: 'translateX(-50%)',
            width: 130, height: 36, background: '#0A0A0A', borderRadius: 20, zIndex: 20,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1A1A1A' }} />
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1A1A1A' }} />
        </div>

        <div style={{ width: '100%', height: '100%', background: 'white', borderRadius: 40, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          {/* Ambient purple radial gradient at bottom — sits behind everything */}
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%',
              background: 'radial-gradient(ellipse 140% 100% at 50% 110%, #7C3AED 0%, rgba(124,58,237,0.55) 35%, rgba(124,58,237,0.15) 60%, transparent 80%)',
              pointerEvents: 'none', zIndex: 0, borderRadius: '0 0 40px 40px',
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

export function StatusBar() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false })), 10000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{
      height: 50, background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
      display: 'flex', alignItems: 'flex-end', padding: '0 22px 8px',
      flexShrink: 0, position: 'relative', zIndex: 2,
    }}>
      <span style={{ color: 'white', fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>{time}</span>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 12 }}>
          {[4, 6, 9, 12].map((h, i) => (
            <div key={i} style={{ width: 3, height: h, background: i < 3 ? 'white' : 'rgba(255,255,255,0.4)', borderRadius: 1 }} />
          ))}
        </div>
        <Wifi size={13} color="white" />
        <div style={{ width: 22, height: 11, borderRadius: 3, border: '1.5px solid white', display: 'flex', alignItems: 'center', padding: '1px', position: 'relative' }}>
          <div style={{ width: '75%', height: '100%', background: 'white', borderRadius: 1.5 }} />
          <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 2, height: 5, background: 'white', borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}
