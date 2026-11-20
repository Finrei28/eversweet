"use client";

import { MotionConfig } from "framer-motion";
import { createElement, type ReactNode } from "react";

/**
 * Has every framer-motion animation on the site follow the reader's "reduce
 * motion" setting: under it, the menu's, contact's and feedback's entrances fade
 * in where they slid up, and nothing moves across the page. CSS animation and
 * transitions are held to the same setting in globals.css; the falling desserts
 * check it themselves and draw already landed.
 *
 * `createElement` rather than JSX so the test can import it: Vitest here runs
 * `.ts` only, with no JSX transform.
 */
export function MotionPreferences({ children }: { children: ReactNode }) {
  return createElement(MotionConfig, { reducedMotion: "user" }, children);
}
