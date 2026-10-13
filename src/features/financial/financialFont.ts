// Registers the display font from embedded data; if it fails the fallback stack applies.
import { bricolageGrotesqueWoff2 } from './financialFontData';
let requested = false;
export function loadFinancialFont() {
  if (requested || typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return;
  requested = true;
  new FontFace('Bricolage Grotesque', `url(${bricolageGrotesqueWoff2}) format("woff2")`, { weight: '200 800', display: 'swap' })
    .load().then(face => document.fonts.add(face)).catch(() => { requested = false; });
}
