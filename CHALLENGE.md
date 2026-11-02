# 2026 NASA Space Apps Challenge: Lunar Landing Site Evaluation

- Difficulty: Advanced, Intermediate
- Subjects: Human Exploration, Moon, Software, Space Exploration

## Summary

Missions to the Moon's south pole face extreme lighting and communication constraints, and planning them takes careful coordination between science and engineering teams. Tools for determining Sun and Earth positions at candidate landing sites exist, but their complicated interfaces make it difficult to evaluate critical information efficiently. The challenge is to create an intuitive tool or application that lets mission planners, educators, and the public compare landing sites and dates quickly, visualizing Sun and Earth positions relative to the horizon to assess power generation potential and direct-to-Earth communication windows.

## Background

- NASA's CLPS program and other lunar missions depend on selecting landing sites and dates that balance science and engineering needs.
- Sun position determines power for solar arrays and thermal conditions; Earth position determines whether direct communication is possible without relay satellites.
- The south pole (water ice, other resources) has extreme variations in illumination and Earth visibility across lunar days and seasons. Small changes in site or date can dramatically change power and comms windows.
- Missions rarely keep a fixed timeline: delays force planners to evaluate alternative sites in the same region or alternative dates at the same site. Rapid, intuitive scenario comparison would speed these decisions.
- Existing tools (NASA Quickmap, Moon Trek, JPL Horizons) are built for detailed analysis and are hard for non-specialists to use for quick comparison. The gap is an interface that turns ephemeris and topographic data into clear, comparable visualizations.

## Objectives (suggested, not required)

- **Site selection and comparison:** curated list (Apollo sites, CLPS targets, other commercial and national programs) plus custom lunar coordinates; side-by-side or sequential comparison.
- **Date and time flexibility:** choose landing date/time; explore change across lunar days or seasons.
- **Sun and Earth visualization:** show Sun and Earth relative to the horizon at a site on a chosen date; show time remaining before sunset or Earthset.
- **Power and comms assessment:** solar elevation angle, sunlight duration, Earth visibility windows.
- **Multiple visualization approaches:** 2D maps, 3D surface views, other creative representations.
- **Temporal dynamics:** animations or timelines over a lunar day or multiple days.
- **Accessibility across skill levels:** detailed for planners; approachable for educators and the public.
- Format is open: web app, mobile app, interactive visualization, educational game, etc.

## Technical considerations

- Ephemeris: JPL Horizons System or pre-computed datasets.
- Topography: LOLA (Lunar Orbiter Laser Altimeter) for realistic surface views and accurate horizon calculation.
- No atmosphere: horizon is set by local terrain and the edge of the lunar sphere; no refraction.
- Solar elevation angle is the key power metric; display it prominently.
- Consider Earth libration and the Moon's orbital variations.
- South pole terrain is complex: steep slopes and deep craters create extreme shadows.

## UX considerations

- Prioritize rapid comparison of multiple site-date combinations.
- Communicate time to sunset/Earthset clearly.
- Make lunar vs terrestrial differences apparent.
- Help users see why small location or date changes have large feasibility impacts.

## Impact

- Support coordination between science and engineering teams.
- Help teams respond quickly to schedule or hardware changes.
- Serve as an educational tool on why lunar mission planning is hard.

Resources: see the Resources tab on the event page (more may be added before the hackathon).
