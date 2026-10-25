// Lightweight fake contact shadows independent of shadow-map quality.
export function shadowAppearance(height,radius=1) {
  const altitude=Math.max(0,height);
  return {opacity:Math.max(.055,.32/(1+altitude*.55)),
    radius:radius*(1+Math.min(altitude,7)*.19)};
}
