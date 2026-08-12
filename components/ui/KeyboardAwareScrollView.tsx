import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  FlatList,
  findNodeHandle,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
  type FlatListProps,
  type ScrollViewProps,
} from 'react-native';

type ScrollResponder = {
  scrollResponderScrollNativeHandleToKeyboard?: (
    nodeHandle: number,
    additionalOffset?: number,
    preventNegativeScrollOffset?: boolean,
  ) => void;
};

function callScrollResponder(responder: object | null, nodeHandle: number) {
  if (!responder) return;
  const candidate = responder as ScrollResponder & { getScrollResponder?: () => object };
  const nested = candidate.getScrollResponder?.();
  const target = nested ?? candidate;
  if ('scrollResponderScrollNativeHandleToKeyboard' in target) {
    const method = target.scrollResponderScrollNativeHandleToKeyboard;
    if (typeof method === 'function') method(nodeHandle, 32, true);
  }
}

function useKeyboardAwareResponder<T extends object>() {
  const ref = useRef<T & ScrollResponder>(null);

  const scrollFocusedInput = useCallback(() => {
    if (Platform.OS !== 'android') return;
    const focused = TextInput.State.currentlyFocusedInput?.();
    if (!focused) return;
    const nativeHandle = findNodeHandle(focused as never) as number | null;
    if (nativeHandle === null) return;
    callScrollResponder(ref.current, Number(nativeHandle));
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', scrollFocusedInput);
    return () => subscription.remove();
  }, [scrollFocusedInput]);

  return ref;
}

export const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(props, forwardedRef) {
  const ref = useKeyboardAwareResponder<ScrollView>();
  useImperativeHandle(forwardedRef, () => ref.current as ScrollView, [ref]);
  const onFocusCapture = useCallback(() => {
    setTimeout(() => {
      const focused = TextInput.State.currentlyFocusedInput?.();
      if (focused) {
        const nativeHandle = findNodeHandle(focused as never) as number | null;
        if (nativeHandle !== null) callScrollResponder(ref.current, Number(nativeHandle));
      }
    }, 50);
  }, [ref]);
  return <View style={{ flex: 1 }} onFocus={onFocusCapture}><ScrollView ref={ref} {...props} /></View>;
});

export function KeyboardAwareFlatList<ItemT>(props: FlatListProps<ItemT>) {
  const ref = useKeyboardAwareResponder<FlatList<ItemT>>();
  const onFocusCapture = useCallback(() => {
    setTimeout(() => {
      const focused = TextInput.State.currentlyFocusedInput?.();
      const nativeHandle = focused ? findNodeHandle(focused as never) as number | null : null;
      if (nativeHandle === null) return;
      callScrollResponder(ref.current, Number(nativeHandle));
    }, 50);
  }, [ref]);
  return <View style={{ flex: 1 }} onFocus={onFocusCapture}><FlatList ref={ref} {...props} /></View>;
}
