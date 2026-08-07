/**
 * The pointer overlay for demo-gate recordings.
 *
 * Playwright's recorder captures the page, not the OS cursor, so an unadorned
 * clip shows things changing with nothing visibly touching them — the viewer
 * has to infer every interaction. This draws the pointer *into* the page,
 * following the real mouse events Playwright dispatches: a dot that tracks
 * the pointer, a ring that snaps shut while a button is held, and a ripple
 * where each press lands.
 *
 * Exported as a plain function so it can be handed to `addInitScript` (which
 * serialises it into the page) and exercised directly by a test. It runs in
 * the browser, not in Node: no imports, no closure over anything out here.
 */
export function installPointerOverlay() {
  const install = () => {
    if (document.getElementById('__capture_cursor')) return;

    const style = document.createElement('style');
    // `pointer-events: none` throughout: the overlay must never intercept the
    // click it is drawing, or the recording would show taps that never landed.
    style.textContent = `
      #__capture_cursor, .__capture_ripple {
        position: fixed; pointer-events: none; z-index: 2147483647;
        will-change: transform, opacity;
      }
      /* Dark ring inside a white halo, so the pointer reads on a pale screen
         and on a saturated button alike — a single-colour cursor disappears
         the moment it lands on a filled control, which is exactly when the
         viewer most needs to see it. */
      #__capture_cursor {
        top: 0; left: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px;
        border: 2px solid rgba(17,19,15,.9); border-radius: 50%;
        background: rgba(255,255,255,.3);
        box-shadow: 0 0 0 2px rgba(255,255,255,.9), 0 2px 6px rgba(0,0,0,.35);
        transition: width .09s, height .09s, margin .09s, background .09s;
      }
      #__capture_cursor.__down {
        width: 16px; height: 16px; margin: -8px 0 0 -8px;
        background: rgba(255,255,255,.85);
      }
      .__capture_ripple {
        width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%;
        border: 2px solid rgba(17,19,15,.85);
        box-shadow: 0 0 0 2px rgba(255,255,255,.75);
        animation: __capture_ping .5s ease-out forwards;
      }
      @keyframes __capture_ping {
        to { transform: scale(4.2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const dot = document.createElement('div');
    dot.id = '__capture_cursor';
    // Parked off-screen until the pointer actually moves. Without this it
    // renders at the top-left corner for the first second of every clip,
    // which reads as a stray mark on the page rather than a cursor.
    dot.style.transform = 'translate(-100px, -100px)';
    document.body.appendChild(dot);

    const place = (e) => {
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    };
    addEventListener('mousemove', place, true);
    addEventListener(
      'mousedown',
      (e) => {
        place(e);
        dot.classList.add('__down');
        const ripple = document.createElement('div');
        ripple.className = '__capture_ripple';
        ripple.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        document.body.appendChild(ripple);
        // Outlive the animation, then stop existing — a flow with fifty taps
        // must not end up with fifty dead nodes in the DOM.
        setTimeout(() => ripple.remove(), 600);
      },
      true,
    );
    addEventListener('mouseup', () => dot.classList.remove('__down'), true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
}
