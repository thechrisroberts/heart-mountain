const SVG_NS = 'http://www.w3.org/2000/svg';
let instanceCount = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const smoothstep = (start, end, value) => {
  const t = clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Draw a conceptual NW–SE section through the Heart Mountain slide.
 * Distances are schematic; the scale bar describes the horizontal drawing only.
 */
export function createSection(container) {
  if (!container || typeof container.appendChild !== 'function') {
    throw new TypeError('createSection requires a DOM container');
  }

  const id = `hm-section-${++instanceCount}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1000 560');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Conceptual geological cross-section of the Heart Mountain slide');
  svg.style.display = 'block';
  svg.style.width = '100%';
  svg.style.height = '100%';
  // Keep labels legible on phones; the host panel scrolls within its own bounds.
  svg.style.minWidth = '900px';
  svg.style.minHeight = '504px';
  svg.style.overflow = 'visible';
  const previousOverflow = container.style.overflow;
  container.style.overflow = 'auto';
  container.appendChild(svg);

  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <linearGradient id="${id}-substrate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#536c67"/><stop offset="1" stop-color="#263c3e"/>
    </linearGradient>
    <linearGradient id="${id}-carbonate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d7be82"/><stop offset=".48" stop-color="#b99c67"/><stop offset="1" stop-color="#816e54"/>
    </linearGradient>
    <linearGradient id="${id}-volcanic" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c17f67"/><stop offset="1" stop-color="#744f4d"/>
    </linearGradient>
    <pattern id="${id}-dots" width="20" height="20" patternUnits="userSpaceOnUse">
      <circle cx="1" cy="1" r=".8" fill="#7ca6a3" opacity=".16"/>
    </pattern>
    <filter id="${id}-glow" x="-30%" y="-100%" width="160%" height="300%">
      <feGaussianBlur stdDeviation="4"/>
    </filter>
  `;
  svg.appendChild(defs);

  const scene = document.createElementNS(SVG_NS, 'g');
  svg.appendChild(scene);

  function update(state = {}) {
    const progress = clamp(state.progress ?? 0, 0, 100);
    const exaggeration = clamp(state.exaggeration ?? 1, 1, 5);
    const layers = state.layers !== false;
    const labels = state.labels !== false;
    const phase = progress / 100;
    const spread = smoothstep(.12, .76, phase);
    const erosion = smoothstep(.78, 1, phase);
    const stage = progress < 12 ? 'BEFORE RELEASE' : progress < 32 ? 'DETACHMENT' : progress < 67 ? 'BLOCK TRANSPORT' : progress < 90 ? 'EMPLACEMENT' : "TODAY'S REMNANTS";

    svg.setAttribute('aria-label', `Conceptual Heart Mountain geological cross-section: ${stage.toLowerCase()}, ${Math.round(progress)} percent through sequence`);

    const grid = [];
    for (let x = 80; x <= 920; x += 70) grid.push(`<path d="M${x} 106V452"/>`);
    for (let y = 116; y <= 446; y += 55) grid.push(`<path d="M76 ${y}H930"/>`);

    const positions = [140, 220, 300, 380, 460, 540];
    const offsets = [0, 38, 94, 158, 228, 308];
    // Base relief is drawn at 1×, then multiplied by the UI value exactly.
    const heights = [37, 41, 44, 40, 39, 34];
    const remnants = [1, .16, .9, .22, .94, .64];
    const blocks = positions.map((baseX, i) => {
      const x = baseX + offsets[i] * spread;
      const width = 80;
      const remnantHeight = 1 - erosion * (1 - remnants[i]);
      const height = heights[i] * exaggeration * remnantHeight;
      const top = 354 - height;
      const lip = i % 2 ? 9 : 4;
      const notch = i % 3 ? 3 : 8;
      const shape = `M${x.toFixed(1)} 354 L${(x + 2).toFixed(1)} ${(top + lip).toFixed(1)} L${(x + 17).toFixed(1)} ${top.toFixed(1)} L${(x + 48).toFixed(1)} ${(top + notch).toFixed(1)} L${(x + 75).toFixed(1)} ${(top + lip + 2).toFixed(1)} L${(x + width).toFixed(1)} 354 Z`;
      const clipId = `${id}-block-${i}`;
      const bedLines = layers ? [0.3, .55, .76].map((f, j) => {
        const y = top + height * f;
        return `<path d="M${(x - 2).toFixed(1)} ${y.toFixed(1)} Q${(x + 30).toFixed(1)} ${(y + (j % 2 ? -3 : 3)).toFixed(1)} ${(x + 83).toFixed(1)} ${(y + 2).toFixed(1)}" fill="none" stroke="#493f36" stroke-opacity=".35" stroke-width="2"/>`;
      }).join('') : '';
      const capOpacity = i === 4 ? 0.78 * (1 - smoothstep(.84, 1, phase)) : 0.78 * (1 - erosion * .62);
      const rustCap = `<path d="M${(x + 4).toFixed(1)} ${(top + lip + 2).toFixed(1)} L${(x + 18).toFixed(1)} ${(top - 3).toFixed(1)} L${(x + 40).toFixed(1)} ${(top + 4).toFixed(1)} L${(x + 58).toFixed(1)} ${(top + 1).toFixed(1)} L${(x + 77).toFixed(1)} ${(top + lip + 5).toFixed(1)} L${(x + 77).toFixed(1)} ${(top + 20).toFixed(1)} Q${(x + 38).toFixed(1)} ${(top + 15).toFixed(1)} ${(x + 3).toFixed(1)} ${(top + 23).toFixed(1)} Z" fill="url(#${id}-volcanic)" opacity="${capOpacity.toFixed(2)}"/>`;
      return `<g>
        <clipPath id="${clipId}"><path d="${shape}"/></clipPath>
        <path d="${shape}" fill="url(#${id}-carbonate)" stroke="#e6c995" stroke-opacity="${(.08 + .64 * smoothstep(.04, .3, phase)).toFixed(2)}" stroke-width="1.35" stroke-linejoin="round"/>
        <g clip-path="url(#${clipId})">${rustCap}${bedLines}</g>
        <path d="M${x.toFixed(1)} 354H${(x + width).toFixed(1)}" stroke="#152b2f" stroke-opacity=".45" stroke-width="3"/>
      </g>`;
    }).join('');

    const faultCracks = progress >= 12 && progress < 67 ? positions.slice(1).map((baseX, i) => {
      const x = baseX + offsets[i + 1] * spread;
      const visible = smoothstep(.12, .26, phase) * (1 - smoothstep(.5, .67, phase));
      return `<path d="M${x.toFixed(1)} 240 l-5 29 6 29 -5 31" fill="none" stroke="#0b1e23" stroke-width="${(2.5 * visible).toFixed(2)}" opacity="${visible.toFixed(2)}"/>`;
    }).join('') : '';

    const heartX = 460 + 228 * spread + 40;
    const heartY = 354 - heights[4] * exaggeration * (1 - erosion * (1 - remnants[4])) - 15;
    const volcanoTip = 354 - 44 * exaggeration;
    const volcanoLabelY = Math.min(270, Math.max(140, volcanoTip - 20));
    const motionOpacity = smoothstep(.2, .39, phase) * (1 - smoothstep(.67, .82, phase));
    const labelOpacity = smoothstep(.78, .96, phase);

    scene.innerHTML = `
      <rect x="0" y="0" width="1000" height="560" fill="#0c1b20"/>
      <rect x="55" y="97" width="890" height="360" rx="5" fill="url(#${id}-dots)" opacity=".58"/>
      <g fill="none" stroke="#a0c1be" stroke-width=".7" opacity=".105">${grid.join('')}</g>
      <path d="M78 355 C262 352 494 356 710 362 C806 365 883 365 925 365 L925 453 L78 453 Z" fill="url(#${id}-substrate)"/>
      <path d="M78 406 C277 393 454 411 648 405 C763 401 861 413 925 411 M78 432 C275 422 467 438 651 431 C786 425 867 438 925 436" fill="none" stroke="#a9bcb2" stroke-width="1.2" opacity="${layers ? '.27' : '0'}"/>
      <path d="M78 356 C273 353 492 356 710 363 C803 366 875 365 925 365" fill="none" stroke="#51cbd3" stroke-width="9" opacity=".13" filter="url(#${id}-glow)"/>
      <path d="M78 356 C273 353 492 356 710 363 C803 366 875 365 925 365" fill="none" stroke="#75d6d9" stroke-width="2.1" stroke-dasharray="7 5" opacity=".93"/>
      <g transform="translate(0 ${(354 * (1 - exaggeration)).toFixed(1)}) scale(1 ${exaggeration.toFixed(2)})">
        <path d="M78 354 C100 350 112 345 135 345 L151 334 L171 340 L196 326 L219 337 L243 310 L263 338 L295 346 L317 354Z" fill="url(#${id}-volcanic)" stroke="#c38770" stroke-opacity=".58" stroke-width="1.3" opacity=".75"/>
        <path d="M135 345 L151 334 L171 340 M219 337 L243 310 L263 338" fill="none" stroke="#e9a187" stroke-opacity=".43" stroke-width="1.1"/>
      </g>
      <g>${blocks}</g>
      <g>${faultCracks}</g>
      <path d="M338 119 H690 m-12 -7 12 7 -12 7" fill="none" stroke="#b6d9d2" stroke-width="1.5" opacity="${motionOpacity.toFixed(2)}"/>
      <text x="514" y="107" text-anchor="middle" fill="#b6d9d2" font-size="11" letter-spacing="2" opacity="${motionOpacity.toFixed(2)}">SLIDE TRANSPORT</text>
      <path d="M75 453 H925" stroke="#8eaaa5" stroke-opacity=".38"/>
      <rect x="56" y="17" width="171" height="25" rx="3" fill="#1d363a" stroke="#45636a" stroke-width=".7"/>
      <circle cx="69" cy="29.5" r="3.4" fill="#d8b478"/>
      <text x="81" y="33" fill="#dce6df" font-family="Inter, system-ui, sans-serif" font-size="10" font-weight="700" letter-spacing="1.4">GEOLOGIC SECTION</text>
      <text x="943" y="33" text-anchor="end" fill="#bbd0cb" font-family="Inter, system-ui, sans-serif" font-size="10" letter-spacing="1.5">NW → SE</text>
      <text x="75" y="76" fill="#e9d6b1" font-family="Inter, system-ui, sans-serif" font-size="13" font-weight="650" letter-spacing="2">${stage}</text>
      <text x="925" y="76" text-anchor="end" fill="#8fb3b2" font-family="Inter, system-ui, sans-serif" font-size="11" letter-spacing="1">STAGE ${String(Math.round(progress)).padStart(2, '0')} / 100</text>
      ${labels ? `
        <text x="79" y="136" fill="#aec4be" font-family="Inter, system-ui, sans-serif" font-size="11" letter-spacing="1.4">SOURCE AREA</text>
        <text x="925" y="136" text-anchor="end" fill="#aec4be" font-family="Inter, system-ui, sans-serif" font-size="11" letter-spacing="1.4">BASIN</text>
        <path d="M407 328 L398 303 H314" fill="none" stroke="#e6d2a9" stroke-width="1" opacity=".8"/>
        <text x="308" y="300" text-anchor="end" fill="#ead6b0" font-family="Inter, system-ui, sans-serif" font-size="11">older Paleozoic carbonate</text>
        <path d="M538 395 L577 388 H670" fill="none" stroke="#b5d2ca" stroke-width="1" opacity=".78"/>
        <text x="676" y="392" fill="#c5d8d1" font-family="Inter, system-ui, sans-serif" font-size="11">younger substrate</text>
        <path d="M585 364 L591 344 H654" fill="none" stroke="#73d9dc" stroke-width="1" opacity=".9"/>
        <text x="660" y="347" fill="#85e4e5" font-family="Inter, system-ui, sans-serif" font-size="11">detachment</text>
        <path d="M243 ${volcanoTip.toFixed(1)} L263 ${(volcanoLabelY - 3).toFixed(1)} H287" fill="none" stroke="#c78e79" stroke-width="1" opacity="${(1 - erosion * .35).toFixed(2)}"/>
        <text x="293" y="${volcanoLabelY.toFixed(1)}" fill="#d6a38c" font-family="Inter, system-ui, sans-serif" font-size="11" opacity="${(1 - erosion * .35).toFixed(2)}">volcanic rock</text>
        <path d="M${heartX.toFixed(1)} ${heartY.toFixed(1)} V${(heartY - 25).toFixed(1)} H${(heartX + 50).toFixed(1)}" fill="none" stroke="#e7d09c" stroke-width="1.2" opacity="${labelOpacity.toFixed(2)}"/>
        <text x="${(heartX + 56).toFixed(1)}" y="${(heartY - 22).toFixed(1)}" fill="#f3dba9" font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="650" opacity="${labelOpacity.toFixed(2)}">Heart Mountain</text>
      ` : ''}
      <g transform="translate(140 478)" font-family="Inter, system-ui, sans-serif">
        <text x="0" y="0" fill="#a3bbb6" font-size="10" letter-spacing="1.3">HORIZONTAL DISTANCE</text>
        <path d="M0 18 H760 M0 13 V23 M380 13 V23 M760 13 V23" fill="none" stroke="#bed1c8" stroke-width="1.5"/>
        <path d="M0 18 H380" stroke="#d3ba82" stroke-width="3"/>
        <text x="0" y="37" fill="#d7e0d8" font-size="10" text-anchor="middle">0</text>
        <text x="380" y="37" fill="#d7e0d8" font-size="10" text-anchor="middle">25</text>
        <text x="760" y="37" fill="#d7e0d8" font-size="10" text-anchor="middle">50 km</text>
      </g>
      <text x="925" y="544" text-anchor="end" fill="#91aaa6" font-family="Inter, system-ui, sans-serif" font-size="10" letter-spacing=".4">CONCEPTUAL SECTION  ·  RELIEF ×${exaggeration.toFixed(1)}  ·  TIME IS NOT TO SCALE</text>
      ${layers ? `<g transform="translate(76 543)" font-family="Inter, system-ui, sans-serif" font-size="10" fill="#bacbc3">
        <rect x="0" y="-8" width="13" height="7" rx="1" fill="#bd9f6b"/><text x="19" y="0">carbonate</text>
        <rect x="104" y="-8" width="13" height="7" rx="1" fill="#a16e5c"/><text x="123" y="0">volcanic</text>
        <rect x="201" y="-8" width="13" height="7" rx="1" fill="#56756d"/><text x="220" y="0">substrate</text>
      </g>` : ''}
    `;
  }

  update({ progress: 0, exaggeration: 1, layers: true, labels: true });

  return {
    update,
    dispose() {
      svg.remove();
      container.style.overflow = previousOverflow;
    },
  };
}
