"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
export function useFullscreen(ref: RefObject<HTMLElement>) {
  const [active, setActive] = useState(false);
  const fallback = useRef(false),
    opener = useRef<HTMLElement | null>(null);
  const close = useCallback(async () => {
    fallback.current = false;
    if (document.fullscreenElement === ref.current)
      await document.exitFullscreen().catch(() => {});
    setActive(false);
    opener.current?.focus();
  }, [ref]);
  const toggle = useCallback(async () => {
    if (active) {
      await close();
      return;
    }
    opener.current = document.activeElement as HTMLElement;
    try {
      if (!ref.current?.requestFullscreen) throw Error("unsupported");
      await ref.current.requestFullscreen();
      fallback.current = false;
      setActive(true);
    } catch {
      fallback.current = true;
      setActive(true);
    }
  }, [active, close, ref]);
  useEffect(() => {
    const change = () => {
      if (document.fullscreenElement === ref.current) setActive(true);
      else if (!fallback.current) {
        setActive(false);
        opener.current?.focus();
      }
    };
    document.addEventListener("fullscreenchange", change);
    return () => document.removeEventListener("fullscreenchange", change);
  }, [ref]);
  useEffect(() => {
    if (!active) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fallback.current) {
        event.preventDefault();
        void close();
      }
      if (event.key === "Tab") {
        const targets = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]),select:not([disabled]),input:not([disabled]),a[href],[tabindex="0"]',
          ) || [],
        ).filter((el) => el.getClientRects().length > 0);
        const first = targets[0],
          last = targets[targets.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", key);
    };
  }, [active, close, ref]);
  return { active, toggle };
}
