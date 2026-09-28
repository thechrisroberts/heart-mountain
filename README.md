# Heart Mountain · Deep Time Atlas

A real-terrain interactive geological field guide to the Heart Mountain slide in northwest Wyoming, approximately 49 million years ago.

## Open the site

From this directory:

```sh
npm install
npm run dev -- --open
```

Dependencies are already installed in this copy. You can also double-click `Start Heart Mountain.command` on macOS. Stop the local server with **Control-C** in its Terminal window.

## Explore

- **Real 3D landscape:** USGS/Mapzen elevation data with USGS/USDA NAIP aerial photography over roughly 100 × 89 km. Drag to orbit and scroll/pinch to zoom.
- **Feel the scale:** move between an actual Forest Service field photograph, the detailed 3D Heart Mountain terrain, and the full region. A 78.4 km geographic span links Silver Gate and Heart Mountain; it is not a block-displacement estimate.
- **Area comparisons:** draw 1 × 1 km, 10 × 10 km, and 59.16 × 59.16 km squares on the actual terrain. The largest equals 3,500 km²; these are comparison squares, not slide boundaries.
- **2D cross-section:** inspect volcanic cover, carbonate rock, substrate, and the basal detachment. On narrow screens, swipe horizontally inside the diagram, or focus it and use arrow keys.
- **Timeline:** jump between five stages, scrub, or play at 0.5×, 1×, or 2×. Playback speed is an animation setting, not a geological speed estimate.
- **Scale:** adjust vertical exaggeration from 1× to 5×; compare against horizontal distance bars. In 3D the scale bar updates with camera zoom and refers to local projected ground distances at the view center. True vertical scale (1×) is the default. The 2D section remains schematic.
- **Layers and labels:** toggle explanatory overlays. Reset restores the initial view and settings.
- **Mechanisms:** compare proposed roles of gas pressure, pore-fluid pressure, and dynamic weakening, with references to the geological literature.

## Scientific limits

The terrain is a real modern DEM with georeferenced aerial imagery. It is not the Eocene land surface or a physics simulation. The gold corridor illustrates broad regional transport direction rather than an exact block trajectory or mapped boundary. Modern towns, fields, and vegetation establish geographic scale; they did not exist at the time of the slide. Timeline stages and the separate 2D cross-section are interpretive. Playback does not encode measured speed or duration.

The regional elevation mesh is 1025×1025 vertices; the Heart Mountain detail patch is 513×513. Coordinates use locally scaled Web Mercator ground kilometers, with a sub-percent scale variation across this region. Aerial image extents match the DEM bounds. Data preparation is reproducible via `scripts/terrain-data.py` (uses the Python standard library); provenance is recorded in `public/data/ATTRIBUTION.md` and the metadata files.

The ~49 Ma age follows newer dating; older accounts often round the event to 48 Ma. Published area and runout estimates differ with reconstruction and definition. The central distinction is between the enormous transported sheet and modern Heart Mountain, one of its erosional remnants. The site treats the friction mechanisms as potentially complementary hypotheses.

Primary references are linked in the site's Field Notes section:

- USGS / Yellowstone Volcano Observatory, 2021: https://www.usgs.gov/observatories/yvo/news/largest-landslide-world
- Malone et al., 2017: https://doi.org/10.1086/692328
- Goren et al., 2010: https://doi.org/10.1029/2009JB007113
- Mitchell et al., 2015: https://www.sciencedirect.com/science/article/pii/S0012821X14006785
- Zamani et al., 2023: https://doi.org/10.1029/2022JB026185

## Build and verify

```sh
npm run build
npm run preview
npm run check
```

The production site is in `dist/`. Deploy that folder to a static host. It needs no backend, account, API key, or external asset requests. All fonts are bundled locally with their SIL Open Font Licenses in `public/fonts/`.

`npm run check` builds and runs 15 browser checks against a temporary preview server on port 4183. It uses installed Google Chrome through Playwright, saves screenshots and `artifacts/verification.json`, and closes its browser and preview server. Install Chrome before running this command on another machine, or change the Playwright channel in `scripts/verify.mjs` to a locally installed browser.

## Files

- `src/main.js` — interface, state, timeline, scientific explanations
- `src/scene.js` — georeferenced DEM meshes, aerial imagery, geographic overlays, scale comparisons, and camera flights
- `src/section.js` — SVG cross-section
- `src/style.css` / `src/fonts.css` — responsive visual design
- `public/data/` — bundled elevation arrays, aerial imagery, photographs, and attribution
- `artifacts/` — desktop, mobile, cross-section previews, and verification results

Built with Vite and Three.js. Browser WebGL support enables the 3D view; unsupported devices automatically receive the 2D view.
