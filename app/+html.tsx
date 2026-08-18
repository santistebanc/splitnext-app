import { colors } from '@/src/ui/theme';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only HTML shell. Full-bleed — the phone bezel lives on the landing
 * `/try` page, not in the app. `#overlay-root` is a sibling of the React
 * mount so drawers portal above the tree (`InFrameOverlay`).
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
        <style dangerouslySetInnerHTML={{ __html: shellCss }} />
      </head>
      <body>
        {children}
        <div id="overlay-root" />
      </body>
    </html>
  );
}

const shellCss = `
html, body {
  height: 100%;
  margin: 0;
  background: ${colors.bg};
}
#root,
#root > div {
  height: 100%;
  width: 100%;
  background: ${colors.bg};
}
#overlay-root {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 100;
  pointer-events: none;
}
`;
