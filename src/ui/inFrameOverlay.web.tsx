import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';

export const OVERLAY_ROOT_ID = 'overlay-root';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

/**
 * RN `Modal` portals to `document.body` with `position: fixed`, which paints
 * over the desktop around the phone frame. This portals into `#overlay-root`
 * (sibling of `#root` inside `#phone-frame`) so the overlay is clipped by the
 * frame, sits above the React tree, and scrolls with it.
 */
export function InFrameOverlay({ visible, onRequestClose, children }: Props) {
  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onRequestClose]);

  if (!visible || typeof document === 'undefined') return null;
  const host = document.getElementById(OVERLAY_ROOT_ID);
  if (!host) return null;

  return createPortal(
    <View style={styles.host} pointerEvents="auto">
      {children}
    </View>,
    host,
  );
}

const styles = StyleSheet.create({
  host: {
    height: '100%',
  },
});
