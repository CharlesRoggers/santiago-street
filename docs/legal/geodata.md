# Geographic data (§10)

Purpose: use real urban structure (street network, block shapes, elevation) as a *foundation*
for a fictionalized district — never as a 1:1 reproduction.

| Source | Licence | Commercial use | Attribution | Notes |
|---|---|---|---|---|
| OpenStreetMap | ODbL 1.0 | Yes | Required ("© OpenStreetMap contributors") | Derived databases must be shared under ODbL if publicly distributed; a produced work (the game) needs attribution + a notice on how to get the underlying data. Keep OSM extracts as a build-time input, not shipped as a database. |
| Copernicus DEM / SRTM | Free/open | Yes | Recommended | Elevation only |
| Chile IDE / gob.cl open data | Varies per dataset | Check each | Check each | Verify licence per file before use |
| Google Maps / Street View | Proprietary ToS | **No** | — | Not to be used as textures, references to trace, or game data. |

Process: record source, licence, download date and processing steps in this file before any
data enters `packages/content`.
