TL;DR: The GIBS colormap "binned, not exact" claim is confirmed. Sea ice layer IDs and the sea-level route stay unverified, so Options 0, 1, 2, 4 carry Amber or Red risk until one check runs.
Round 3 data check (data-scout). Words: about 650.

## Option data needs (G / A / R)

**Option 0 (baseline): R.** Live any-EIC-visual CV legend reading (Red: no tested method); Narrator/Composer data (Amber); sea level (Red: no verified rate or route); GIBS, NSIDC and GISTEMP (Green).

**Option 1 (One Story, Two Ears): A.** Ice cross-check via NSIDC monthly CSV (Green: verified). GIBS ice layer ID (Amber: not verified). Blind-test data is not a dataset.

**Option 2 (Frame Jukebox): A.** GIBS ice and SST layers (Amber: IDs unverified). SVS 5113 fire frames are TIFF/EXR, so offline conversion is needed (Amber). Fire layer ID unchecked.

**Option 3 (Time Under Your Finger): A.** Place-by-year values need a precomputed regional grid from GIBS tiles (Amber: decoding colours to values is real work). GISTEMP headline facts (Green).

**Option 4 (Mauritius): R as written, A if SST-only.** Indian Ocean SST (Amber: MUR is 0.01 deg, 2002 onward; PO.DAAC needs Earthdata login [unverified: search snippet]). Sea level (Red: no verified route). Drop sea level and it becomes Amber.

**Option 5 (Tune Your Own Earth): A.** Colormaps are verified (Green). Needs one verified layer ID before the demo (Amber).

## Verifications

1. **Colormap "binned": CONFIRMED.** [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/GHRSST_Sea_Surface_Temperature.xml] Entries are ranges, for example `<ColorMapEntry rgb="45,0,28" ... sourceValue="[0.00,0.15)" value="[0.00,0.15)" ref="2"/>`, with a 0.15 °C bin width. Sea ice `GHRSST_Sea_Ice_Concentration.xml` uses 1 % bins, `[0,1)` through `[99,100)`, plus a single value `[100]`. The spec says discrete layers map exact values, and continuous layers map ranges [verified: https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/]. So "exact" is wrong for SST and ice.

2. **GIBS layer IDs: NOT VERIFIED.** The WMTS GetCapabilities file is 5.3 MB. I read only its first 100 k characters (MERRA2, GEDI, AVISO, OMPS, SWDB). The visualization catalog page failed to load. Colormap filenames suggest candidate names (`GHRSST_Sea_Surface_Temperature`, `GHRSST_Sea_Ice_Concentration`, `AMSR_Sea_Ice_Concentration`, `SSMIS_Sea_Ice_Concentration`), but a colormap name is not a layer ID. Unverified leads: `GHRSST_L4_MUR25_Sea_Surface_Temperature` (a JPL record, [unverified]); AMSR2 names that conflict across third-party output ([unverified]). Action: download `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml` and grep for `Sea_Ice` and `Sea_Surface`. Takes a few minutes in a terminal.

3. **NSIDC September CSV: CONFIRMED (path).** [verified: https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/] lists `N_09_extent_v4.0.csv` (also N_01 to N_12, 2352 bytes each). Access is plain HTTPS directory listing; no login is stated on the NSIDC page [verified: https://nsidc.org/data/g02135]. I did not open the file, so its columns, year range and units are [unverified].

4. **Indian Ocean SST reachable without heavy download?** Probably yes, as an inference. GIBS serves MUR-based SST tiles per date, so a team can pull small tiles and never download the grid. The Worldview 3.7.0 notes list a "Sea Surface Temperature (MUR25)" layer [unverified: search snippet; the wiki needed login and I did not follow it]. Still unverified: whether GIBS tiles cover the Mauritius area at a usable zoom, and that the layer ID exists. PO.DAAC direct download is the fallback and is heavier.

## Gaps and risks

- No GIBS layer ID is confirmed. This blocks Options 1, 2, 3 and 5 until verification 2 runs.
- Sea level has no verified route (carried from Round 1).
- Round 1 "Amber" for SST still stands.

Weakest point of my own findings: The GetCapabilities check covered 2% of the file, so the absence of sea-ice and SST IDs in my read proves nothing. Also, my NSIDC check confirms only the file name, not its contents.

## Follow-up: verified GIBS layer IDs

Source: [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml]

**(a) Arctic sea ice: `MODIS_Terra_L3_Sea_Ice_Daily`.** Daily, 2000-02-24 to 2026-11-04, with gaps. Colormap `MODIS_L3_Sea_Ice.xml` is ice vs. other (classification, not percent). Use for extent cross-checks only.
Runner-up: `AMSRU2_Sea_Ice_Concentration_12km` (percent, daily, 2012-07-02 to 2025-09-01). Ends before 2026.

**(b) Indian Ocean SST: `GHRSST_L4_MUR_Sea_Surface_Temperature`** (1 km). Daily, 2002-06-01 to 2026-11-04, with gaps. Colormap `GHRSST_Sea_Surface_Temperature.xml`, 0.15 °C bins.

Do not use `GHRSST_L4_GAMSSA_GDS2_Sea_Ice_Concentration`: titled SST, uses the ice colormap.
