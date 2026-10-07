import type { PressableStateCallbackType } from 'react-native';

export interface PressableState {
  pressed: boolean;
  hovered: boolean;
}

/** React Native Web adds `hovered` to the pressable state; core types don't declare it. */
export function readPressableState(state: PressableStateCallbackType): PressableState {
  const hovered = (state as { hovered?: boolean }).hovered ?? false;
  return { pressed: state.pressed, hovered };
}
