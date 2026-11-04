# NASA data sources (T32)

**Status: incomplete.** On 5 Nov 2026 I could not find the Earth Information Center (EIC) Sea Surface Temperature visualization, or the released challenge resources (they arrive on 13 Nov). Everything below was seen on a NASA page; anything not seen is listed under "Still to find out" and is **not** guessed. Dhruv: use this as a starting list, not as settled facts.

## What was and was not found

- **earth.gov** (the EIC home page) loads, but it has no link to a sea surface temperature, Arctic sea ice or global temperature anomaly visualization. It links to other tools (Hometown Dashboard, Mobile Climate Mapper, GEOS Earth Now, Global Sea Level Change) and to theme pages such as `https://earth.gov/themes/sea-level-change`. The theme pages were not opened.
- Searches for the three topics all returned pages on **NASA's Scientific Visualization Studio (SVS, `svs.gsfc.nasa.gov`)**, not earth.gov. EIC visualizations may be hosted or mirrored there; that is unconfirmed.
- The 2026 Space Apps resources and judging guide are not out yet (13 Nov).

## Candidates seen on SVS (search results only; pages not opened in full)

| Topic | Page | What the search result said |
|---|---|---|
| Sea surface temperature | [Earth Day 2020: SST from January 2016 through March 2020](https://svs.gsfc.nasa.gov/4809) | A video of that period; colour scale 0 to 32 °C. |
| Sea surface temperature | [Sea Surface Temperature (SST) – Near Real Time](https://svs.gsfc.nasa.gov/api/5265) | Uses JPL's MUR (Multi-scale Ultra-high Resolution) SST analysis. |
| Arctic sea ice | [Arctic Sea Ice Minimum 2024](https://svs.gsfc.nasa.gov/5382) | Lists Sea Ice Concentration [DMSP: SSM/I] and Comiso's September Minimum Sea Ice Concentration as datasets; the minimum was 3.67 million km². |
| Arctic sea ice | [Arctic Sea Ice Minimum 2025](https://svs.gsfc.nasa.gov/5583), [2023](https://svs.gsfc.nasa.gov/5162/), [2022](https://svs.gsfc.nasa.gov/5030/) | Yearly series; the 2025 animation runs from the March maximum to the September minimum. |
| Arctic sea ice | [Annual Arctic Sea Ice Minimum Area 1979–2024, with graph](https://svs.gsfc.nasa.gov/5395) | Minimum for each year 1979–2024, from passive microwave data. |

Sea ice extent, as these pages define it, is the total area where ice concentration is at least 15%.

**Credit wording seen:** SVS pages ask that items be credited to NASA's Scientific Visualization Studio; the 2024 sea ice page also credits the Blue Marble data to Reto Stockli (NASA/GSFC). Check each page's own credit and licence line before using an image.

## Still to find out (for each of: Sea Surface Temperature, Arctic sea ice, global temperature anomaly)

Fill these in from the released resources or the page itself. Do not assume.

- [ ] Frame format and size (PNG, JPEG, video; pixel size)
- [ ] Number of dated frames, and how far apart (daily, monthly, yearly)
- [ ] Whether the legend values can be read: is there a colour bar with numbers, and is it the same on every frame?
- [ ] Link to the underlying dataset
- [ ] Licence and credit wording
- [ ] One or two date pairs from the same season that show real change
- [ ] Anything that breaks our assumptions: no fixed legend, a map projection that shifts between frames, text or land drawn over the ocean, frames that are videos not images

## What to watch for (from what we already know)

- Our method (see `docs/PLAN.md`) needs a **fixed colour legend with readable values** and the **same region at the same pixel position on every frame**. A video, a changing legend or a moving projection would each need extra work in T33.
- Sea ice is often shown as **ice or no ice** (white on dark), not as a gradient. If we pick it, the sound mapping may need to follow area or concentration, not a colour scale.
- SST legends seen run **0 to 32 °C**, wider than our synthetic data's 0 to 30; the category ranges in `mapping` would need to be rescaled.
