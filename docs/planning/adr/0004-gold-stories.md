# ADR-0004: Gold stories: Arctic sea ice (GIBS MODIS) + gated Mauritius SST close

**Date**: 2026-11-06
**Status**: proposed (revision 3: this is now a **worked example and fallback set**. The real stories are chosen from the data the event provides.)
**Deciders**: brainstorm team, council (4 voices), human checkpoint 2026-11-06 (chose "merge")

## Context

The baseline planned three gold stories (temperature, Arctic ice, sea level or upwelling) from 1979 onward. Verification showed:
- The GIBS sea-ice layer with a long record is `MODIS_Terra_L3_Sea_Ice_Daily`: an ice/not-ice classification from 2000-02-24 [verified: https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/1.0.0/WMTSCapabilities.xml].
- `GHRSST_L4_MUR_Sea_Surface_Temperature` runs from 2002-06-01, with a tile with valid ocean pixels near Mauritius [verified: same; tile fetched in Round 5].
- Sea level has no verified data route.
- NSIDC G02135 gives September extent 1979–2026 for cross-checking [verified: https://noaadata.apps.nsidc.org/NOAA/G02135/north/monthly/data/N_09_extent_v4.0.csv].

## Decision

The main story is **Arctic September sea ice from 2000**, sonified from "ice seen" pixel counts in GIBS MODIS composites. It is cross-checked against NSIDC, which never drives the melody. In the ice colormap only sea ice is opaque; ocean, cloud, night and no-data are all transparent [verified: https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_Sea_Ice.xml], so the value is a lower bound and is labelled that way. If Test A fails or has no verdict by hour 6, **SST becomes the main story**. The **silence beat uses SST**, whose time dimension lists real missing dates (e.g. 2023-02-02/03); the ice record has no September gap. The close is **Mauritius sea-surface temperature** (MUR, offshore point), kept only if day-1 Test B passes.

## Alternatives Considered

### Alternative 1: Three stories from 1979 driven by NASA/NSIDC numbers
- **Pros**: a longer, more dramatic record.
- **Cons**: the melody would not come from frames; it fails the brief's core ask.
- **Why not**: "frames are the foundation".

### Alternative 2: Mauritius coast duet (nearshore vs offshore SST) as the main story
- **Pros**: novel and local.
- **Cons**: contrast unproven; the island is land-masked; Validity 2.8.
- **Why not**: too risky as a core; the duet is cut.

## Consequences

### Positive
- Every story is frame-based with a verified layer ID and an honest start date.
- A local close is kept without staking the core on it.

### Negative
- "26 years", not "45 years": less drama.
- The ice classification undercounts under cloud, so composites are needed.

### Risks
- Test A fails: SST becomes the main story (no re-plan). Test B fails: the Mauritius close is cut.
