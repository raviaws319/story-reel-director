// Modes and visual styles. Each style owns its image prompt language, palette,
// caption look, default voice, music mood and motion pacing.

export const MODES = {
  story: {label: 'Story Narrator', defaultStyle: 'cinematic', music: 'pad', captionStyle: 'bold'},
  kids: {label: 'Kids Stories', defaultStyle: 'storybook', music: 'musicbox', captionStyle: 'karaoke'},
  food: {label: 'Food Videos', defaultStyle: 'warm-kitchen', music: 'pluck', captionStyle: 'bold'},
};

export const STYLES = {
  // ---------- Story Narrator ----------
  cinematic: {
    modes: ['story'], label: 'Cinematic',
    prompt: 'cinematic digital painting, dramatic volumetric lighting, rich color grading, shallow depth of field, film still composition, highly detailed',
    negative: 'text, letters, watermark, logo, caption, signature, blurry, deformed hands, extra limbs',
    palette: {bg: '#0e1116', ink: '#f5f1e8', accent: '#f2a541', soft: '#2a2f3a'},
    font: 'Sans', voice: 'en-US-ChristopherNeural', voiceRate: '-4%', motionScale: 1.0,
  },
  sketch: {
    modes: ['story'], label: 'Pencil Sketch',
    prompt: 'expressive hand-drawn pencil and ink sketch on warm off-white paper, loose confident linework, light watercolor wash accents, editorial illustration',
    negative: 'text, letters, watermark, logo, photo, 3d render, color-saturated',
    palette: {bg: '#f6f1e6', ink: '#1f1d1a', accent: '#c4472d', soft: '#e3dccb'},
    font: 'Hand', voice: 'en-US-AndrewNeural', voiceRate: '+0%', motionScale: 0.8,
  },
  anime: {
    modes: ['story'], label: 'Anime-Inspired',
    prompt: 'anime-inspired 2D illustration, clean cel shading, vivid sky, expressive characters, detailed painted background, original characters',
    negative: 'text, letters, watermark, logo, photorealistic, existing anime characters, franchise characters',
    palette: {bg: '#101833', ink: '#ffffff', accent: '#ff5d8f', soft: '#27315c'},
    font: 'Sans', voice: 'en-US-GuyNeural', voiceRate: '+2%', motionScale: 1.1,
  },

  // ---------- Kids Stories ----------
  storybook: {
    modes: ['kids'], label: 'Watercolor Storybook',
    prompt: "soft watercolor children's picture book illustration, gentle pastel colors, rounded friendly shapes, cozy warm light, cute expressive characters, safe and wholesome",
    negative: 'text, letters, watermark, scary, violent, dark, horror, weapons, realistic, sharp teeth',
    palette: {bg: '#fff7ec', ink: '#3b2f4a', accent: '#ff9f68', soft: '#ffe3c7', highlight: '#ffd447'},
    font: 'Hand', voice: 'en-GB-SoniaNeural', voiceRate: '-12%', motionScale: 0.6,
  },
  'cartoon-3d': {
    modes: ['kids'], label: 'Bright 3D Cartoon',
    prompt: 'bright colorful 3D cartoon render for kids, soft clay-like materials, big expressive eyes, rounded characters, sunny cheerful lighting, original characters, safe and wholesome',
    negative: 'text, letters, watermark, scary, violent, horror, weapons, existing cartoon characters, brand mascots',
    palette: {bg: '#eaf6ff', ink: '#16324f', accent: '#2bb673', soft: '#c9e8ff', highlight: '#ffcf33'},
    font: 'Sans', voice: 'en-US-EmmaNeural', voiceRate: '-8%', motionScale: 0.7,
  },

  // ---------- Food Videos ----------
  'warm-kitchen': {
    modes: ['food'], label: 'Warm Kitchen (photo-real)',
    prompt: 'appetizing professional food photography, warm natural window light, rustic wooden table, steam rising, shallow depth of field, rich textures, overhead or 45-degree angle',
    negative: 'text, letters, watermark, logo, packaging brand, plastic look, unappetizing, hands deformed',
    palette: {bg: '#1c140f', ink: '#fff8ef', accent: '#ffb547', soft: '#3a2a20'},
    font: 'Sans', voice: 'en-US-AriaNeural', voiceRate: '+4%', motionScale: 1.0,
  },
  'flat-food': {
    modes: ['food'], label: 'Flat Illustrated',
    prompt: 'flat vector food illustration, bold clean shapes, cheerful saturated palette, subtle grain texture, top-down layout, minimal background',
    negative: 'text, letters, watermark, logo, photorealistic, 3d render',
    palette: {bg: '#fff4e0', ink: '#2b2118', accent: '#ef5b3b', soft: '#ffd9a8'},
    font: 'Sans', voice: 'en-US-JennyNeural', voiceRate: '+5%', motionScale: 0.8,
  },
};

export function styleFor(project) {
  return STYLES[project.style];
}
