TL;DR: The ice and Mauritius SST data paths work: the NSIDC September file, the GIBS tile URLs and colour keys, and the GISTEMP annual table were all opened or downloaded. Ice-vs-NSIDC agreement (Test A) is not yet tested; one tile proves only that the pipeline returns ice pixels.
Round 5 data check (data-scout). Files: scratchpad `...\scratchpad\r5data\` (N_09_extent_v4.0.csv, MODIS_L3_Sea_Ice.xml, GHRSST_SST_colormap.xml, MODIS_VIIRS_AOD.xml, GLB.Ts+dSST.csv, three PNG tiles). Data read as data only, nothing run.

## Status per item
1. NSIDC G02135: VERIFIED (columns, years, no gaps, Sept min). Units NOT verified.
2. MODIS ice: VERIFIED (colormap, URL template, one 2012-09-15 tile returns ice pixels). Extent agreement with NSIDC NOT tested.
3. GHRSST MUR: VERIFIED (URL template, TMS, one tile, valid ocean pixels near Mauritius). PO.DAAC login for direct download only partly verified.
4. Third layer (AOD): layer ID, date range and colormap VERIFIED. No tile fetched.
5. GISTEMP annual table: VERIFIED (direct download).
6. Credits: VERIFIED for all four (source pages quoted below).

## 1. NSIDC G02135 [verified: https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv, downloaded, 2352 bytes]
- Columns (header has spaces): `year, mo, source_dataset, region, extent, area`.
- September rows 1979 to 2026, 48 rows, consecutive, no missing years.
- Units: the file does not state them. "extent" and "area" are NOT verified as million km2 (NSIDC README not opened).
- Minimum: `2012,9,NSIDC-0051,N,3.57,2.41`.
- Source switch: 2025 and 2026 use `NSIDC-0803`; NSIDC-0051 covers 1979 to 2024. Note this in the story.
- Citation and licence: [verified: https://nsidc.org/data/g02135]. Page is "BASIC Level of Service". No login stated.

## 2. MODIS ice layer
- Layer: `MODIS_Terra_L3_Sea_Ice_Daily`, title "Sea Ice Extent (L3, Daily, MODIS, Terra)", format image/png, TileMatrixSet `1km`. [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml, scratchpad copy]
- Tile template: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_L3_Sea_Ice_Daily/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`
- Time dimension: default 2026-11-04, ranges from 2000-02-24 with gaps.
- Resolution: TMS `1km`, levels 0 to 6; level 6 is 80x40 tiles of 512 px (about 0.0088 deg, about 1 km per pixel).
- Colormap [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_Sea_Ice.xml]: one "Classifications" ramp. Sea ice is `rgb="255,100,100" sourceValue="200" transparent="false" ref="7"`, legend tooltip "Sea Ice". Other classes (Ocean `35,36,117`, Cloud, Land, Night, etc.) are `transparent="true"`. This is a class map, not a concentration.
- Tile fetched: `.../2012-09-15/1km/4/0/10.png` [verified by download]. Result: 512x512 PNG. 278 of 16,384 sampled pixels are opaque, all `255,100,100`. Tile covers about 72 to 90 N, 0 to 18 E (computed from the TMS, not from the response).
- Not done: summing ice pixels over the full Arctic per September and comparing with NSIDC. This is Test A.

## 3. GHRSST MUR SST layer
- Layer: `GHRSST_L4_MUR_Sea_Surface_Temperature`, title "Sea Surface Temperature (L4, MUR, GHRSST)", image/png, TMS `1km`. [verified: capabilities copy]
- Tile template: `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/{Time}/{TileMatrixSet}/{TileMatrix}/{TileRow}/{TileCol}.png`
- Time dimension: default 2026-11-04, ranges from 2002-06-01 with gaps.
- Colormap [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml]: 0.15 deg C bins, binned not exact. Example: `rgb="255,153,0" sourceValue="[24.60,24.75)"`.
- Tile fetched: `.../2020-06-15/1km/6/24/52.png` [verified by download]. Covers about 54 to 58.5 E, 18 to 22.5 S (computed). 512x512 PNG.
- Result: 98% of sampled pixels in the tile are opaque, with orange SST colours. The exact Mauritius pixel (398,250 in the tile) is transparent, which fits the island being land-masked. Of a 60x60 px window around that point, 49% is opaque.
- Answer: yes, the tile has valid ocean pixels near Mauritius. The island itself returns no data, so the sound must rest there.
- The date 2020-06-15 is an arbitrary test date.

## 4. Third choose-menu layer (proposal)
- Proposed: `MODIS_Terra_Aerosol_Optical_Depth_3km`, title "Aerosol Optical Depth (3km, MODIS, Terra)", image/png, TMS `2km`. [verified: capabilities copy]
- Time dimension: default 2026-11-06, ranges from 2000-02-24 with gaps (about 26 years of record).
- Colormap `MODIS_VIIRS_AOD.xml` v1.3 [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_VIIRS_AOD.xml]: 153 entries, continuous ranges, for example `[-1000,0)` and `[5000]`.
- Not done: tile fetch. Not checked: whether the AOD tiles are valid over Mauritius or the Arctic.
- Weakness: aerosol depth has a weak link to a "Earth story" for listeners. Alternative with an unchecked colormap: none verified in this round.

## 5. GISTEMP v4 annual table [verified: https://data.giss.nasa.gov/gistemp/tabledata_v4/GLB.Ts+dSST.csv, downloaded]
- Header: "Land-Ocean: Global Means", then `Year,Jan,...,Dec,J-D,D-N,DJF,MAM,JJA,SON`. Annual column is `J-D`.
- Example: 2025 J-D = 1.18. 2026 row is partial (`***` for later months). Values are deviations from the 1951 to 1980 base, per the GISTEMP page.
- Index page [verified: https://data.giss.nasa.gov/gistemp/] says plain-text LOTI tables exist. The `data_v4.html` index was not opened.

## 6. Credit lines (quoted from the source pages)
- NSIDC [verified: https://nsidc.org/data/g02135]: "Fetterer, F., Knowles, K., Meier, W. N., Savoie, M., Windnagel, A. K. & Stafford, T. (2025). Sea Ice Index. (G02135, Version 4). [Data Set]. Boulder, Colorado USA. National Snow and Ice Data Center. https://doi.org/10.7265/a98x-0f50". Condition: "As a condition of using these data, you must cite the use of this data set."
- GIBS [verified: https://nasa-gibs.github.io/gibs-api-docs/]: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." No licence or rate-limit statement on the page.
- GHRSST MUR [verified: https://podaac.jpl.nasa.gov/dataset/MUR-JPL-L4-GLOB-v4.1]: "JPL MUR MEaSUREs Project. 2015. GHRSST Level 4 MUR Global Foundation Sea Surface Temperature Analysis. Ver. 4.1. PO.DAAC, CA, USA. Dataset accessed [YYYY-MM-DD] at https://doi.org/10.5067/GHGMR-4FJ04". Resolution 0.01 deg. The S3 bucket needs Earthdata Login. Whether the HTTPS path does is NOT verified.
- GISTEMP [verified: https://data.giss.nasa.gov/gistemp/]: "GISTEMP Team, 2026: GISS Surface Temperature Analysis (GISTEMP), version 4. NASA Goddard Institute for Space Studies. Dataset accessed [YYYY-MM-DD] at https://data.giss.nasa.gov/gistemp/." Credit: "NASA's Goddard Institute for Space Studies" or "NASA GISS/GISTEMP". Paper: Lenssen et al. 2024, J. Geophys. Res. Atmos., 129, e2023JD040179, doi:10.1029/2023JD040179.
- Note: credit text only. No NASA logos.

## 7. Smallest story.json for the ice story [computed]
- September extent only, 48 `[year, extent]` pairs, minified: 627 bytes.
- Skeleton (ids, source, unit, one layer, one moment, one fact): about 220 bytes.
- With 20 to 40 pre-written Q&A entries at about 150 to 250 bytes each [assumption]: about 4 to 12 KB total.
- The story file does not need pixel data. Store the NSIDC values and the per-year ice check result.

Weakest point of my own findings: Item 2 proves only that the URL and colour key work, from one tile with 1.7% ice, so it says nothing about extent accuracy. The NSIDC units, the AOD tiles, the MUR tile date and the PO.DAAC HTTPS login status are also open. I used the scratchpad copy of the capabilities file rather than a fresh download, so its date defaults could be a few days old.
