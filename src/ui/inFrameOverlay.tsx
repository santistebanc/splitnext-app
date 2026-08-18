import { Modal } from 'react-native';
import type { ReactNode } from 'react';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
};

/** Native: a system modal. Web portals into `#overlay-root`. */
export function InFrameOverlay({ visible, onRequestClose, children }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      {children}
    </Modal>
  );
}
