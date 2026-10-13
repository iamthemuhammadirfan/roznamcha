import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Height of the on-screen keyboard, 0 when it's closed. The app draws edge-to-edge, so
 * Android no longer shrinks the window for the keyboard, and KeyboardAvoidingView
 * measured itself wrongly under the stack header and didn't move. Screens with a pinned
 * footer lift it by this much instead.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subs = [
      Keyboard.addListener(show, (e) => setHeight(e.endCoordinates.height)),
      Keyboard.addListener(hide, () => setHeight(0)),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);
  return height;
}
