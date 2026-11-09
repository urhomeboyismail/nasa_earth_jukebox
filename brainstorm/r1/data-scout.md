# Data scout, Round 1 (independent)

TL;DR: GIBS colormaps map colour to value ranges, not exact values. Arctic ice and global temperature are Green; sea level and Indian Ocean SST are Amber.

## Priority checks

**(a) GIBS colormaps: verified.** Each XML has a ColorMap (RGB to value ranges for continuous layers) and a Legend, linked from WMTS GetCapabilities. Current path: gibs.earthdata.nasa.gov/colormaps/v1.3/<layer>.xml [verified: https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/] [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/]. Rating: **Green** to read; **Amber** for "exact".

**(b) EIC/SVS frames: Amber.** Page 5113 (VIIRS fires) offers frame directories (824 items, format unstated) [verified: https://svs.gsfc.nasa.gov/5113]. Page 5521 offers only MP4 and one PNG, and the SVS FAQ says frames are mostly .exr or .tif [verified: https://svs.gsfc.nasa.gov/help/].

**(c) Sources**
- Arctic sea ice: NSIDC Sea Ice Index v4 (G02135), daily and monthly, 1978 to present, ASCII/CSV, direct HTTPS, no login stated, citation required [verified: https://nsidc.org/data/g02135]. **Green.**
- Global temperature: GISTEMP v4 monthly land-ocean index, plain-text tables (1951–1980 baseline); CSV not confirmed [verified: https://data.giss.nasa.gov/gistemp/]. **Green.**
- Sea level: sealevel.nasa.gov gave no rate or download route [verified: https://sealevel.nasa.gov/]. PO.DAAC GMSL product, DOI 10.5067/GMSLM-TJ151 [unverified: search snippet]. **Amber**, probably Earthdata login.
- Indian Ocean SST: PO.DAAC MUR 1 km daily SST, 2002 to present, Earthdata login [unverified: https://podaac.jpl.nasa.gov/announcements/2020-02-17_GHRSST_MUR_SST_Data_in_Cloud]. It misses 1981, so the upwelling record needs another product; GIBS lists a GHRSST SST colormap [inference]. **Amber.**

## 1. Proposal (upgrade)

Use GIBS-by-date as the frame source for gold stories, not MP4 extraction. Cross-check against NSIDC (ice) and GISTEMP (temperature); both show no login requirement. The ice story is about 600 monthly rows [assumption]. The plan says "exact", but a colormap gives a value range per colour bin. Store the bin width and label confidence "binned".

## 2. Radical alternative: today's fires

The VIIRS fire frame set on SVS 5113 updates daily [verified: https://svs.gsfc.nasa.gov/5113]. SVS says its content is public domain and asks for credit [verified: https://svs.gsfc.nasa.gov/help/]. The jukebox plays the last week of fires, one date per frame. Risks: frames are TIFF or EXR, so they need offline conversion, and the feed may change before the demo.

## 3. Cut

MP4-to-frame extraction as the default live-mode path (Feature 1, step 1). Some EIC pages offer only MP4 (5521), and compression breaks colour matching in pipeline step 4. Make live mode GIBS-only, or cut it from core. Cut the sea-level gold story unless PO.DAAC access and a verified rate both work on day one.

Weakest point of my own findings: I did not open a real colormap XML or confirm sea-ice or SST layer names, so the bin-width point is inferred from the docs. Sea-level and MUR claims rest on search snippets. I did not check the full VIIRS frame listing.
