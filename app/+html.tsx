import { colors } from '@/src/ui/theme';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only HTML shell. A wide window gets a 420×900 phone frame, always
 * centered, scaled (not reflowed) so the whole bezel fits in the viewport
 * — it shrinks on a short or narrow window and grows on a large one.
 * Capture's 420px viewport is below the breakpoint and stays full-bleed.
 *
 * Scale is a unitless `--phone-scale` set from the real viewport by an
 * inline script — CSS `min(vw / px)` does not resolve in every engine,
 * which left the bezel unscaled and stuck to a corner.
 *
 * `#overlay-root` is a sibling of the React mount, inside the frame, so
 * drawers portal there instead of covering the desktop (`InFrameOverlay`).
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: phoneFrameCss }} />
        <script dangerouslySetInnerHTML={{ __html: fitPhoneFrameScript }} />
      </head>
      <body>
        <div id="phone-stage">
          <div id="phone-sizer">
            <div id="phone-frame">
              {children}
              <div id="overlay-root" />
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

const fitPhoneFrameScript = `(function(){
  var PAD=24, OW=440, OH=920, BP=480;
  function fit(){
    var w=document.documentElement.clientWidth;
    var h=document.documentElement.clientHeight;
    var s=w<BP?1:Math.max(0.2, Math.min((w-2*PAD)/OW,(h-2*PAD)/OH));
    document.documentElement.style.setProperty('--phone-scale', String(s));
  }
  fit();
  addEventListener('resize', fit);
  addEventListener('orientationchange', fit);
  if(window.visualViewport) visualViewport.addEventListener('resize', fit);
})();`;

const phoneFrameCss = `
html {
  --phone-scale: 1;
}
html, body {
  height: 100%;
  margin: 0;
  background: ${colors.bg};
}
#phone-stage,
#phone-sizer {
  height: 100%;
  width: 100%;
}
#phone-frame {
  position: relative;
  height: 100%;
}
#root,
#root > div {
  height: 100%;
  width: 100%;
  background: ${colors.bg};
}
#overlay-root {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
  pointer-events: none;
}
@media (min-width: 480px) {
  html, body {
    height: 100% !important;
    overflow: hidden !important;
    background: ${colors.line};
  }
  #phone-stage {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    background: ${colors.line};
  }
  #phone-sizer {
    position: relative;
    width: calc(440px * var(--phone-scale));
    height: calc(920px * var(--phone-scale));
  }
  #phone-frame {
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: content-box;
    width: 420px;
    height: 900px;
    border: 10px solid ${colors.ink};
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 18px 50px rgba(26, 28, 22, 0.28);
    transform: scale(var(--phone-scale));
    transform-origin: 0 0;
  }
  #root,
  #root > div {
    height: 100%;
    width: 100%;
  }
}
`;
