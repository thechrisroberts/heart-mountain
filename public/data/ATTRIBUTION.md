# Geographic data and imagery

Elevation: Mapzen Terrain Tiles, accessed 2026-09-28 through the public AWS elevation-tiles-prod bucket. United States 3DEP (formerly NED), GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. USGS datasets are public domain. Documentation: https://registry.opendata.aws/terrain-tiles/ and https://github.com/tilezen/joerd/blob/master/docs/attribution.md

Orthophotography: USGS, USDA, The National Map: Orthoimagery (NAIP), public domain. Exported from https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer . Both geographic bounds and returned image extents are recorded in metadata.json and heart-metadata.json.

Processing: Terrarium elevations decoded to meters, resampled on EPSG:3857 grids, rounded into little-endian unsigned 16-bit meter arrays. The regional mesh has 1025×1025 vertices; the local patch has 513×513. In the viewer, projected coordinates are converted to approximate local ground kilometers using the regional center latitude. Modern aerial imagery is draped on these surfaces. No synthetic terrain heights are substituted. Visual vertical exaggeration, if selected, is reported by the controls.

Photograph: USDA Forest Service Northern Region, public domain. See heart-mountain-usfs.attribution.json and https://commons.wikimedia.org/wiki/File:Heart_Mountain_WY.jpg .

The animated transport overlay is authored educational content, not a surveyed slide perimeter, measured rock path, reconstructed Eocene elevation model, or timed dynamics model. The 78.4 km annotation is the approximate great-circle separation of present-day Silver Gate and the Heart Mountain summit. Comparison squares have areas of 1, 100, and 3500 square kilometers in the locally scaled coordinate frame; they are not slide boundaries.
