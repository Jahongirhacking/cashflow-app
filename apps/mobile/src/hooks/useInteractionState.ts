import { useCallback, useMemo, useState } from 'react';

export interface InteractionState {
  hovered: boolean;
  pressed: boolean;
  handlers: {
    onHoverIn: () => void;
    onHoverOut: () => void;
    onPressIn: () => void;
    onPressOut: () => void;
  };
}

/**
 * Hover/press tracking as plain state. Needed where a Pressable is wrapped by
 * `<Link asChild>`, which drops function-form `style` props on web.
 */
export function useInteractionState(): InteractionState {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const onHoverIn = useCallback(() => setHovered(true), []);
  const onHoverOut = useCallback(() => setHovered(false), []);
  const onPressIn = useCallback(() => setPressed(true), []);
  const onPressOut = useCallback(() => setPressed(false), []);
  return useMemo(
    () => ({ hovered, pressed, handlers: { onHoverIn, onHoverOut, onPressIn, onPressOut } }),
    [hovered, pressed, onHoverIn, onHoverOut, onPressIn, onPressOut],
  );
}
