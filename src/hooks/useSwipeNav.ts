import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

type Options = {
  /** Route to navigate to on left-swipe (finger moves right→left). */
  onSwipeLeft?: string;
  /** Route to navigate to on right-swipe (finger moves left→right). */
  onSwipeRight?: string;
  /** Min horizontal distance in px to trigger nav. */
  threshold?: number;
  /** Max vertical drift before we abandon (treat as scroll). */
  verticalTolerance?: number;
};

/**
 * Lightweight horizontal swipe navigation.
 * - Tracks pointer in real time
 * - Provides `dx` so the screen can follow the finger
 * - Snaps back if the user releases below threshold
 * - Ignores swipes that start on inputs / scrollable horizontal elements
 */
export function useSwipeNav({
  onSwipeLeft,
  onSwipeRight,
  threshold = 80,
  verticalTolerance = 60,
}: Options) {
  const navigate = useNavigate();
  const [dx, setDx] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);
  const cancelled = useRef(false);
  const dxRef = useRef(0);

  useEffect(() => {
    dxRef.current = dx;
  }, [dx]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      const target = e.target as HTMLElement | null;
      // Ignore swipes started on form fields, sliders, or videos
      if (target?.closest("input, textarea, select, [data-no-swipe], video, audio")) return;
      startX.current = t.clientX;
      startY.current = t.clientY;
      active.current = true;
      cancelled.current = false;
      setIsSwiping(true);
    };

    const onMove = (e: TouchEvent) => {
      if (!active.current || cancelled.current) return;
      const t = e.touches[0];
      const deltaX = t.clientX - startX.current;
      const deltaY = t.clientY - startY.current;
      
      // If user is scrolling vertically, abandon
      if (Math.abs(deltaY) > verticalTolerance && Math.abs(deltaY) > Math.abs(deltaX)) {
        cancelled.current = true;
        setDx(0);
        setIsSwiping(false);
        return;
      }
      
      // Only track in directions we have a destination for
      if (deltaX < 0 && !onSwipeLeft) return;
      if (deltaX > 0 && !onSwipeRight) return;
      
      setDx(deltaX);
    };

    const onEnd = () => {
      if (!active.current) return;
      active.current = false;
      const final = dxRef.current;
      setIsSwiping(false);
      
      if (final <= -threshold && onSwipeLeft) {
        navigate({ to: onSwipeLeft as any });
      } else if (final >= threshold && onSwipeRight) {
        navigate({ to: onSwipeRight as any });
      }
      setDx(0);
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onSwipeLeft, onSwipeRight, threshold, verticalTolerance, navigate]);

  return { dx, isSwiping };
}
