/**
 * Web half of the D-023 split. The frame CSS and the first-paint scale
 * script live in `app/+html.tsx`. This keeps `--phone-scale` in sync on
 * resize after the bundle loads. Same formula as the inline script:
 * contain in the viewport, no 1× cap, so a narrower window shrinks the
 * bezel instead of clipping it.
 */

const PAD = 24;
const OUTER_W = 440;
const OUTER_H = 920;
const BREAKPOINT = 480;

function fitPhoneFrame() {
  if (typeof document === 'undefined') return;
  const w = document.documentElement.clientWidth;
  const h = document.documentElement.clientHeight;
  const s =
    w < BREAKPOINT
      ? 1
      : Math.max(0.2, Math.min((w - 2 * PAD) / OUTER_W, (h - 2 * PAD) / OUTER_H));
  document.documentElement.style.setProperty('--phone-scale', String(s));
}

if (typeof window !== 'undefined') {
  fitPhoneFrame();
  window.addEventListener('resize', fitPhoneFrame);
  window.addEventListener('orientationchange', fitPhoneFrame);
  window.visualViewport?.addEventListener('resize', fitPhoneFrame);
}

export const phoneFrame = true;
