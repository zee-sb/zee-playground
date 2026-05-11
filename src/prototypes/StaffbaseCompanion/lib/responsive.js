import { useEffect, useState } from 'react';

// True when viewport is ≤768px. Drives the mobile layout switch
// (full-bleed chat, no sidebar, no phone-mockup frame).
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

// Mirrors window.visualViewport.height + offsetTop. iOS Safari moves the
// layout viewport when the soft keyboard opens; this gives us the actual
// visible viewport so we can size/anchor a fixed shell against it.
export function useVisualViewport() {
  const [vv, setVv] = useState(() =>
    typeof window !== 'undefined' && window.visualViewport
      ? { height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop }
      : null
  );
  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!v) return;
    const update = () => setVv({ height: v.height, offsetTop: v.offsetTop });
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => {
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
    };
  }, []);
  return vv;
}
