import { colors } from '@/src/ui/theme';
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Web-only HTML shell. A wide window gets a fixed 420×900 phone frame;
 * if that does not fit, the page scrolls. Capture's 420px viewport is
 * below the breakpoint and stays full-bleed.
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
      </head>
      <body>{children}</body>
    </html>
  );
}

const phoneFrameCss = `
html, body {
  height: 100%;
  margin: 0;
  background: ${colors.bg};
}
#root,
#root > div {
  height: 100%;
  background: ${colors.bg};
}
@media (min-width: 480px) {
  html, body {
    display: block;
    height: auto !important;
    min-height: 100%;
    overflow: auto !important;
    background: ${colors.line};
  }
  #root {
    box-sizing: content-box;
    width: 420px;
    height: 900px;
    margin: max(24px, calc((100dvh - 920px) / 2)) auto;
    border: 10px solid ${colors.ink};
    border-radius: 28px;
    overflow: hidden;
    box-shadow: 0 18px 50px rgba(26, 28, 22, 0.28);
  }
  #root > div {
    height: 100%;
  }
}
`;
