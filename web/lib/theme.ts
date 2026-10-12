// Light and dark mode. The choice lives in a cookie and is read before the
// first paint by THEME_SCRIPT, which sets the html element's color-scheme;
// every colour token is light-dark(day, night), so that one property switches
// the whole site. Changing the setting applies on the next page load.

export type ThemeChoice = "device" | "light" | "dark";

export const THEME_COOKIE = "theme";

/** Browser-bar colours, matching --color-ground in each mode. */
export const THEME_COLOURS = { dark: "#0d1a15", light: "#f3f7f2" };

/** Runs in <head> before the body paints. Kept tiny and dependency-free. The
 *  theme-color metas may come after it in <head>, so they're redone on load. */
export const THEME_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);if(!m)return;document.documentElement.style.colorScheme=m[1];var f=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(e){e.setAttribute("content",${JSON.stringify(
  THEME_COLOURS,
)}[m[1]]);e.removeAttribute("media")})};f();document.addEventListener("DOMContentLoaded",f)}catch(e){}})()`;

export function readThemeChoice(): ThemeChoice {
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
  return m ? (m[1] as ThemeChoice) : "device";
}

export function saveThemeChoice(choice: ThemeChoice) {
  document.cookie =
    choice === "device"
      ? `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
}

/** A colour that differs by mode, for inline styles and SVG paint. */
export function themed(dark: string, light: string) {
  return dark === light ? dark : `light-dark(${light}, ${dark})`;
}

/** The [dark, light] halves of a colour made by themed(). */
export function splitThemed(colour: string): [string, string] {
  const m = /^light-dark\((#[0-9a-f]{6}), (#[0-9a-f]{6})\)$/i.exec(colour);
  return m ? [m[2], m[1]] : [colour, colour];
}

/** Whether a team colour holds up on the light ground. Thin chart lines need
 *  2.5:1 (rules out white and gold); thick bars only need to beat white (1.3:1). */
export function readsOnLight(hex: string, min = 2.5) {
  const y = [1, 3, 5]
    .map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  return 1.05 / (y + 0.05) >= min;
}
