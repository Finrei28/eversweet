import type { Appearance } from "@stripe/stripe-js";

import tokens from "~/styles/designTokens.json";

const c = tokens.colors;

/**
 * Stripe's card fields, dressed as the redesign's own (`Input variant="field"`,
 * `Label variant="field"`): white, edged in `input` and in ink once focused, a 14px
 * radius, bold 15px labels. Stripe draws them in its own frame, which the site's CSS
 * cannot reach, so this is the only way in. Every colour comes from the tokens.
 *
 * The face is named, not loaded. Stripe's frame cannot use the copy of Figtree that
 * next/font serves this site, and fetching one from Google Fonts would introduce a third
 * party the privacy policy does not name, so the fields fall back to the system's sans
 * where the device has no Figtree of its own.
 */
export const stripeAppearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: c.foreground,
    colorBackground: c.card,
    colorText: c.foreground,
    colorTextSecondary: c.mutedForeground,
    colorTextPlaceholder: c.mutedForeground,
    colorDanger: c.destructive,
    colorSuccess: c.success,
    colorIcon: c.mutedForeground,
    fontFamily:
      "Figtree, PingFang SC, Hiragino Sans GB, Microsoft YaHei, system-ui, sans-serif",
    fontSizeBase: "16px",
    fontWeightNormal: "500",
    borderRadius: "14px",
    spacingUnit: "4px",
    gridRowSpacing: "16px",
    gridColumnSpacing: "12px",
  },
  rules: {
    ".Label": {
      fontSize: "15px",
      fontWeight: "700",
      color: c.foreground,
      marginBottom: "8px",
    },
    // 52px tall, as the site's fields are.
    ".Input": {
      border: `1px solid ${c.input}`,
      boxShadow: "none",
      padding: "14px 16px",
    },
    ".Input:focus": {
      borderColor: c.foreground,
      boxShadow: `0 0 0 1px ${c.foreground}`,
    },
    ".Input--invalid": {
      borderColor: c.destructive,
      boxShadow: `0 0 0 1px ${c.destructive}`,
    },
    ".Error": { color: c.destructive, fontSize: "14px" },
  },
};
