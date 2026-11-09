# Prior-art scout, Round 3 (novelty check)

TL;DR: The column scan (Option 2) is already the vOICe and NASA's own Chandra scans, so it is COMMON. Option 5's mapping editor has close prior art in TwoTone and Sonification Sandbox.
Arcand 2024 confirmed: 3,184 participants and "significant self-reported learning gains" (arXiv abstract opened).

Method: WebSearch and WebFetch. [verified] = page I opened; the fetch tool answers through a small model, so quotes are its summary. [unverified] = search snippet or unopened. The Highcharts page returned empty. I did not reopen the r1 TouchingSpace papers.

## Arcand et al. 2024 check

[verified: https://arxiv.org/abs/2403.18082] Title: "A Universe of Sound: Processing NASA Data into Sonifications to Explore Participant Response." The abstract reports 3,184 survey participants (sighted, blind, low-vision) and "significant self-reported learning gains and positive experiential responses." Confirmed. Correction to r1: the r1 cited the Frontiers URL as unverified; the arXiv page is now the verified source. Published in Frontiers in Communication, March 2024.

## Tool landscape

- vOICe: height to pitch, brightness to loudness, left-to-right column scan, about one-second cycle [verified: https://www.seeingwithsound.com/voicover.htm]. The page does not describe finger-selected regions.
- Chandra / NASA Universe of Sound: horizontal scan across Pillars of Creation and Galactic Center, separate layers per wavelength, text descriptions [unverified: https://chandra.si.edu/sound/listen.html, search snippet].
- Brown University (built on a NASA request): finger-driven sonification of stellar images, then a native phone app with haptics [unverified: https://blog.cs.brown.edu/2023/12/18/research-associate-tom-sgouros-and-brown-cs-students-use-sound-and-ai-make-nasa-imagery-accessible/].
- Sonification Sandbox (Georgia Tech): desktop Java toolkit, data-to-sound mapping window, since 2007 [unverified: https://repository.gatech.edu/entities/publication/aba5a8d7-c06e-424a-991f-51ed8e04169b].
- TwoTone: free, open-source web app; user-set pitch ranges; up to 2,000 rows (CSV/Excel); animated playhead [unverified: https://awards.journalists.org/entries/twotone/, snippet]. A NASA GISTEMP sonification made with TwoTone exists [unverified: snippet only, no URL opened].
- Highcharts sonification: could not open; [unverified].
- Device orientation: everGuide acoustic compass clicks [unverified]; Blum, Bouchard and Cooperstock, GPS + compass + accelerometer spatial audio [unverified]; Timbremap, finger-guided non-speech audio on a touch phone [unverified]. No single system found that combines phone pointing with a sonified data map.
- Indian Ocean SST / sea level: none found. Adjacent: Nino 3.4 SST sonified with gamelan scales, authors state no perceptual experiments [unverified: https://arxiv.org/html/2602.14560]. NASA ocean-colour music, including an Indian Ocean piece [unverified: https://mixmag.net/read/nasa-ocean-data-music-scientist-programmer--news]. Not SST.
- Missing data as rest: no accessibility convention found. One musical rest for a dead tree [unverified, single snippet]. Uncertainty sonification exists [unverified: https://ueaeprints.uea.ac.uk/52676/].

## Per option (most novel feature / biggest DONE-BETTER risk)

- Option 0 (baseline): Navigator front door is not searched, so no novelty call. Risk: the live any-video scan is the Chandra and vOICe approach; the phone-touch planet has TouchingSpace (r1).
- Option 1 (One Story, Two Ears): Novel: Side A/B on the same frames over a home drone, and no-data as a heard rest. Risk: Universe of Sound publishes multiple described versions per object, and its 3,184-person evidence base is far larger than anything we can gather in 48 h.
- Option 2 (Frame Jukebox): Column scan is COMMON (vOICe; Chandra). Frame crossfade not searched [unverified]. Risk: the vOICe and Chandra scan already do the core.
- Option 3 (Time Under Your Finger): Novel: place x time under a slider, with the proximity hum keyed to change. Aim-the-phone is COMMON in blind navigation apps (everGuide, Blum et al.). Risk: TouchingSpace (r1) plus everGuide's compass.
- Option 4 (Hold the Ocean): Novel: nearshore vs offshore SST duet for Mauritius. Not found in one search. Risk: the Nino 3.4 gamelan preprint for SST sonification; the Openscapes credit was not checked.
- Option 5 (Tune Your Own Earth): Novel: blind users author the mapping on NASA frames and hear A/B. Risk: TwoTone (web, free, user pitch ranges) and Sonification Sandbox already let people author mappings for generic data.

Weakest point of my own findings: "NEW" calls rest on one search round and on finding nothing. Only the arXiv abstract and the vOICe page were opened; the fetch tool answers through a small model; TwoTone, Sandbox, Brown and Chandra details are from snippets, and Highcharts is unread.
