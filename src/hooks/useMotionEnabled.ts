/**
 * useMotionEnabled - the single source of truth for "should this animate?"
 *
 * Returns SettingsContext's effective `animationsEnabled` (the user's
 * Animations setting, falling back to the OS `prefers-reduced-motion`
 * preference until they choose - see SettingsContext.tsx). Every JS-driven
 * animation in the app (d3 transitions, d3.timer / requestAnimationFrame
 * tweens, the aurora drift loop, inline CSS keyframe animations) reads
 * this instead of calling `matchMedia` itself; when it's false, motion
 * jumps straight to its final state. Plain CSS transitions are handled
 * globally by the `data-animations="off"` rule in index.css.
 */

import { useSettings } from '../context/SettingsContext';

export function useMotionEnabled(): boolean {
  return useSettings().animationsEnabled;
}
