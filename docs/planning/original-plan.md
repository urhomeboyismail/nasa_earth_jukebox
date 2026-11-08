# Earth, Out Loud: Project Plan

NASA Space Apps 2026, The Earth Information Jukebox · Nov 5, 2026 · @Raghav Burtony

## Concept

**One-liner:** Name any NASA Earth visualization, and we let you hear it, touch it and ask it questions, even if you can't see it.

Earth, Out Loud (powered by our Time-Series Harmony Engine) turns NASA Earth Information Center (EIC) visualizations into sound, touch and conversation. A voice agent finds any EIC visualization, a Google ADK pipeline reads its frames and data, and the app plays a soundscape the user can explore with a finger and question at any moment.

**What makes it different:**

- **Any visualization, live.** Not a fixed playlist: the agent browses EIC and builds a playable soundscape from a visualization it has not seen before.
- **Time under your finger.** Published audio-haptic maps (TouchingSpace, UC Santa Cruz, 2026) let blind users explore static places. We add time: hold a spot and hear how it changed over 40 years.
- **Truthful conversation.** Every spoken answer comes from real numbers and cites them. Interpretation only when asked.
- **Designed for blind users first,** using patterns already tested with blind and low-vision people (NASA Chandra sonifications, PhET simulations, vibro-audio maps).

**Scope:** three curated gold stories (global temperature, Arctic sea ice, sea level) plus live mode for any other EIC visualization. Web app, Android phone for the demo.

## The jukebox: shelf, sides and playlist

The brief offers two forms: an interactive UI, or a curated gallery or playlist of generated audio paired with imagery. We do both: the playlist is the way in, and every track on it is interactive. The challenge is named "Jukebox", so judges will look for one first.

**The shelf.** Records grouped under five themes (Atmosphere, Energy, Land, Life, Oceans). Each record is one story: cover frame, title, length and a one-line spoken teaser. The Navigator reads the shelf as spearcons; "Oceans" lists that theme's records; live mode adds a new record to the shelf every time it builds one.

**Two sides per record.**

- **Side A, Listen:** the composed, musical version (snapped to scale, gentle instruments).
- **Side B, Analyze:** the strict data version (no smoothing, exact mapping, values on request).

This makes the brief's "data vs musicality" balance something the user can hold and flip, not a hidden setting.

**Now playing (for sighted users and judges).** The current frame is on screen with a playhead along the timeline, and the area being sonified is highlighted as the sound moves. The judges should see the frame driving the sound, not just hear it. High contrast and large text are on by default; pinch to zoom the frame.

**Playlist export.** Every record downloads as an audio file, its cover frame and a text description (the same words the Narrator speaks). This covers the gallery form of the brief, gives braille-display and deaf-blind users the text, and is the backup if the live demo fails on stage.

**Five levels of interaction:**

| Level | What the user does | Where it lives |
| --- | --- | --- |
| 1. Choose | Pick a visualization | Voice request or the shelf |
| 2. Control | Play, pause, speed, scrub, flip sides | Two-finger time travel; Side A / Side B |
| 3. Explore | Move through the data itself | Touch the planet, listening radius, metal detector mode |
| 4. Converse | Ask questions, get grounded answers | Narrator |
| 5. Create | Make something new | Live mode adds a record; trace a region; export your own clip |

Most entries will stop at level 2. Say the five levels in the pitch.

## Team and ownership

Six people each own one piece and build against one shared story file from the first hour, so nobody waits on anyone.

&#91;embedded content: team structure · 6 roles, 1 shared story file\]

Data engineer and frame analyst fill the story file; sound, agent and frontend read from it; the red team checks everything before it reaches the demo.

**Integration rules:**

- Agree the story file format in the first hour, before any other work.
- Ship a mock story file with made-up values on day one, clearly labelled, so sound, agent and frontend start immediately.
- One story file per story: year, value, units, matching EIC frame, regional values, key moments, fact sheet lines.
- Anything spoken by the Narrator must exist in the story file or fact sheet. No exceptions.
- The Navigator (existing voice assistant) is the single front door; it calls ADK agents, never the reverse.

## Feature 1: Live mode for any EIC visualization

The user names a topic, and in under a minute the app finds the EIC visualization, reads it, and plays it with a legend. The wait is turned into part of the experience.

**Flow:** voice request → Navigator finds the EIC page → frames extracted → colour scale read → story file built → score composed → legend plays → playback.

**Small parts to build:**

1. **Topic matching.** "Something about wildfires" maps to the closest EIC visualization. If several match, the agent offers at most three by name.
2. **Think-aloud progress.** The agent speaks each step: "Found it: global fire activity, 2003 to 2024. Reading the colour scale now." A soft rising tone plays underneath so there is never dead silence.
3. **Step earcons.** Chime when found, click when the legend is read, short swell when the score is ready.
4. **Legend reading.** Locate the colour bar in the frame, sample it end to end, and build a colour-to-value lookup. Read the min and max labels and units from the frame text. For GIBS layers, skip this step and read the layer's colormap file instead (see Building on MyEarthObserver).
5. **Confidence score.** If the legend lookup is unreliable (no colour bar found, labels unreadable, too many unmatched pixels), switch to Simple mode: brightness-only sonification. A muted tone and the words "simple mode" make this clear. Never fake accuracy.
6. **Auto legend clip.** Before playback, play the lowest and highest values: "This is the lowest… and this is the highest. Everything else falls in between."
7. **Auto orientation description.** Generated from the frame: map type, what colour means, date range, where Mauritius sits.
8. **Auto key moments.** Find the largest change, the record value and the steepest year-on-year jump, and mark them as jump points.
9. **Cache.** Every visualization built once is saved, so a second request plays instantly.
10. **Fallback.** If live mode fails, offer the closest gold story: "I couldn't read that one. Want to hear the ice story instead?"

**Gold stories vs live mode:** gold stories are built from their frames and cross-checked against NASA's recorded numbers (see Frame pipeline); if the match is poor, NASA's numbers drive the melody and the frames drive the spatial layer. Live mode uses the frames only. Say this difference out loud in the pitch.

## Frame pipeline: from EIC frames to sound

The brief asks for frames to be the foundation of the audio, so every story, gold or live, is built from frames. Six steps, owned by the frame analyst unless noted.

1. **Get frames, cleanest source first.**
   - GIBS by date: each date is already one frame, and the colormap file gives exact values (data engineer).
   - Published frame sets: many NASA visualization pages offer PNG frame sequences beside the video. Check per visualization; do not assume every EIC page has one.
   - The MP4 as a last resort: extract frames with ffmpeg at a fixed rate, then drop near-duplicates, since animations often hold one date for several frames.
2. **Date every frame.** Read the on-screen date label with text recognition, or spread the known start and end dates evenly across the frames. Discard the in-between "fade" frames that blend two dates: their values are fake.
3. **Clean the frame.** Find the map area once per visualization. Mask the title, logos, date label and colour bar so they are never read as data.
4. **Turn colour into values.** GIBS layers use the colormap file. Everything else matches each pixel to the nearest colour on the sampled legend, measured in Lab colour space (closer to how the eye sees colour than raw RGB), with a tolerance for video compression. Pixels with no data go into a "no data" mask, which drives honest silence.
5. **Reduce each frame to a few numbers.** Global mean; a coarse grid of regional values for touch; the Mauritius cell; share of area above a threshold (the brief's "pixel density"); change from the previous frame; one shape feature per story, such as ice-edge length or the number of fire clusters.
6. **Write one story-file row per frame.** Gold stories are computed in advance. Live mode samples about one frame per year or month so it finishes in under a minute.

**Frame-vs-NASA cross-check (gold stories).** Compute each gold story from its frames, then compare against NASA's recorded numbers for the same dates. The Narrator and the pitch say the result: "We read the picture, and it matches NASA's data to within \[X\]%", with X filled from the actual comparison, never estimated. If the match is poor, the gold story plays NASA's numbers and says so, and the frames stay on the spatial layer only. Owner: frame analyst builds it, red team checks it.

**Refuse what cannot be read honestly.** Rotating globes, moving cameras and cinematic fly-throughs change their geometry between frames, so pixel positions mean nothing. Detect them (the whole frame changes at once, or no colour bar is found), drop the confidence score, and offer the closest record on the shelf: "I can't read this one honestly. Want the ice record instead?"

**Checkpoint:** by the end of day one, one gold story runs end to end through steps 1 to 6, and its cross-check number exists.

## Building on MyEarthObserver

MyEarthObserver (Team NIXIT, on GitHub) is a 2014 Android app. You pick a theme (Atmosphere, Energy, Land, Life, Oceans), pick one of 13 layers and a month between 2011 and 2014, and a pre-rendered image appears over a map with a legend picture beside it. An animate button steps through the months. We reuse its ideas, not its code: the images came from the team's own server, which no longer resolves, and the app never read data values, so there is nothing in it to sonify.

**The upgrade that makes it worth reusing:** NASA GIBS serves the same kinds of layers live, by date, and publishes a colormap file for each raster layer that maps every exact pixel colour to a data value and unit. For those layers, legend reading stops being a computer-vision guess and becomes a lookup.

| MyEarthObserver had | Earth, Out Loud version | Owner |
| --- | --- | --- |
| Five-theme menu | **Theme shelf.** The Navigator speaks the five themes as spearcons; "Oceans" lists its layers by name; "take me to sea temperature" jumps straight there. | Agent |
| 13 layers, 2011–2014, own server | **Live GIBS layers.** Same themes, fetched from GIBS by date (time=YYYY-MM-DD), for any date the layer covers. | Data engineer |
| Legend picture beside the map | **Exact values.** Read the layer's GIBS colormap file and turn each pixel's colour into a value and unit. Confidence is "exact", so these layers never drop to Simple mode. | Frame analyst |
| Month/year picker and 1-frame-per-second animation | **Play the decade.** Each month is one beat; a two-finger swipe steps one month; the Narrator names the month when playback pauses. Same loop, heard instead of watched. | Sound |
| Draw a polygon or a line on the map | **Trace a region / transect.** Draw a loop with a finger and only the inside plays; lift to hear a summary of that area. Draw a line and the app sweeps along it as a melody, for example Mauritius down to Antarctica. | Frontend |

**Starter layers (pick three for the demo):** sea surface temperature, land surface temperature, active fires, vegetation index, night lights, rainfall. These are themes, not verified layer names: in the first hour the data engineer copies the exact layer identifiers and date ranges from the GIBS capabilities document.

**Where it fits: a three-step confidence ladder.**

1. Gold stories: NASA source numbers drive the melody.
2. GIBS layers: exact colour-to-value lookup from the colormap file.
3. Any other EIC visualization: legend reading, with Simple mode as the fallback.

Say this ladder out loud in the pitch. It shows judges you know where every number comes from.

**Rules:**

- Credit MyEarthObserver by name in the README and the pitch as earlier team work; do not present the old code as the base.
- Do not port the Java. Rebuild the fetch in the web app (about a day of work).
- Skip classification layers (for example land cover) for melody: their colours map to labels, not numbers. They can still drive sound icons.
- Checkpoint: one GIBS image fetched and one colormap file parsed within the first six hours. If the colormap fails, that layer drops to step 3 of the ladder.

## Ideas from NASA Openscapes hackathon projects

Two 2021 NASA Openscapes projects, both Python notebooks built on NASA Earthdata ocean datasets. We take their methods, not their code: they are research notebooks that pull large files, while our app plays small, pre-computed story files.

- **Context Data (Cloud Hackathon 2021):** pick a region and a time window, stack several datasets (sea temperature, salinity, sea surface height, wind) onto one common grid and time step, and score each satellite image by how much of it is clear of cloud.
- **Upwelling (Hackweek 2021):** detect coastal upwelling by comparing sea temperature at paired points, one near the coast and one about 300 km offshore. If offshore water is more than 2°C warmer than the coast, that day counts as upwelling. It averages values in a 50 km circle around each point and builds a daily record back to 1981.

**What we build from them:**

| Idea | Inspired by | What the user hears or does | Owner |
| --- | --- | --- | --- |
| **Coast duet** | Upwelling: nearshore vs offshore pairs | Two voices, one for the coast and one for the open sea. While they sit close, the harmony is calm. When the gap passes 2°C, the voices pull apart and a low "cold pulse" sound plays: cold water is rising. The difference of two pixels is invisible on a colour map, which makes this a strong "hearing what the eye misses" moment. | Sound |
| **Event mode (context pack)** | Context Data: region + time window, stacked datasets | "Play the week Cyclone X passed Mauritius." Several datasets become an ensemble, one instrument each. Still at most two play at once; the user solos or swaps instruments by voice. | Data engineer |
| **Common grid rule** | Context Data: regrid to a common space and time | Every layer is resampled to the same grid and the same daily step before it touches sound, so two instruments are never out of sync or mismatched in place. | Data engineer |
| **Honest silence** | Context Data: clear-sky score | Cloud gaps are rests, not invented values: missing data plays as a soft hush and a light haptic tick. Each frame gets a coverage score; frames under the agreed threshold are skipped in Tour mode and announced in Analyze mode. | Frame analyst |
| **Listening radius** | Upwelling: 50 km circle average | The touch finger hears the average inside a circle, not one noisy pixel. Pinch to grow or shrink the circle; the Narrator says its size. | Frontend |
| **Fair-size map** | Upwelling: reprojection to an equal-area-style projection | The touch map uses a projection that keeps sizes roughly fair, so the Arctic no longer feels huge under the finger and spoken distances stay honest. | Frontend |
| **Hear it against normal** | Upwelling: "coastal temperature minus long-term mean" | A soft drone holds the long-term average; the melody plays above or below it, so "warmer than normal" is heard as distance from the drone. | Sound |

**A new Indian Ocean story (answers the open comment about swapping sea level):** "The cold water that feeds fisheries." Monsoon upwelling off the Somali coast and the south-west coast of India, using daily sea temperature from 1981 onward (the record the Upwelling project used). It is regional, seasonal and has a human hook (fishing), and it pairs with the existing seasons-as-heartbeat idea. Recommendation: keep sea level as a gold story only if the data engineer gets its data inside the first day; otherwise swap in this one.

**Rules:**

- Pre-compute offline. The Upwelling project turned 40 years of global grids into small point files; we do the same and ship story files, never raw grids.
- Hand-pick about ten coast/offshore point pairs per region. That is quicker and safer in a hackathon than generating coastlines automatically.
- Every dataset here needs an Earthdata login: create the team account in hour one.
- Event mode is a stretch goal. The coast duet and honest silence come first, because they are cheap and judges can hear them.
- Check every threshold and date range against the source dataset before the demo; the 2°C rule is the Upwelling project's choice, so credit it as such when the Narrator explains it.

## Feature 2: Touch the planet

The map becomes an instrument: a finger hears the value beneath it, feels borders, and is pulled toward the place that changed most. The demo moment is a blind user finding that place by touch in under 30 seconds.

| Gesture | What the user hears and feels |
| --- | --- |
| Drag one finger | Value under the finger as pitch on a fixed scale; hot = bright and sharp, cold = deep and soft |
| Cross land/sea or a region border | Short vibration tick + region name spoken once ("Entering Greenland") |
| Drag over no-data area | Soft static, no pitch; never a made-up value |
| Near Mauritius | Home beacon: soft sonar ping that grows closer, so the user always has an anchor |
| Hold one finger + slide a second finger up | Time travel for that spot only; light double tap each decade, year spoken at start and end |
| Lift finger | One-sentence summary: "North Atlantic, 2023. 1.8 degrees above normal." |
| Double tap | Drill down: longer description of that spot |
| Two fingers, two places, hold | Split stereo: one place in each ear ("Greenland vs Antarctica") |
| Say "find the change" | Metal detector mode (below) |
| Swipe from edge | Map edge thud; edges are walls so the finger never gets lost |

**Metal detector mode (the wow):**

1. The agent already knows where the biggest change is (from the key moments).
2. A pulling sound grows louder and faster as the finger moves toward it; vibration strengthens in step.
3. Moving away, the sound fades. No words, just warmer or colder.
4. On arrival: bright ping + double tap, then "This is where the most ice disappeared: \[X\]% smaller since 1979." The number is filled from the story file at runtime.
5. Next press: "find the next one."

**Breadcrumb memory:** the Narrator remembers the trail and nudges toward unexplored areas: "You've explored the Arctic and Europe. You haven't touched the Pacific yet."

## Audio description system

Five voices, each with one job, so the user is never confused about whether they are hearing data, an event, a description or an interpretation. This follows PhET's split: short sound icons for discrete events, sonification for continuous values, speech for what matters.

| Voice | Job | When it speaks | Example |
| --- | --- | --- | --- |
| 1. Sound icons | Discrete events, no words | Instantly | Chime = loaded; ping + double tap = record broken; thud = map edge |
| 2. Sonification | The continuous data | Always, unless ducked | Pitch rises as temperature rises |
| 3. Orientation | What is on screen, once | When a visualization opens, about 10 s | "A world map, north at the top. Colour shows sea temperature, 1982 to 2024. Blue is cooler than normal, red is warmer. Mauritius is marked with a soft ping, bottom right." |
| 4. Responsive | What just happened after an action | In natural pauses, under 5 s | "Entering Greenland." / "North Atlantic, 2023. 1.8 degrees above normal." |
| 5. Narrator | Answers and interpretation | Only when asked, under 15 s | "What happened here?" → the fact + number. "Why?" → only then the cause, from the fact sheet |

**Verbosity levels** (user picks; Chandra's team found one-size-fits-all sonification wasn't helpful):

- **Quiet:** sound icons + sonification + responsive names only. For experienced users.
- **Guide (default):** all five voices, short forms.
- **Teacher:** adds a one-line "why it matters" after key moments. For classrooms.

**Speaking rules for every voice:**

- Describe before interpreting. Voices 3 and 4 never interpret.
- Short first; more only on request (double tap or "tell me more").
- One word per idea, always the same: "above normal", never mixed with "warmer than average".
- Speak in pauses: sonification pauses while a voice speaks, then resumes.
- Every factual answer carries a number and its year.
- Say "I don't know" rather than guess. The Narrator answers only from the story file and fact sheet.
- Numbers spoken the way people say them: "one point eight degrees", not "1.80 °C".
- Never talk over a key moment; wait until it has played.

**"What's that sound?"** works at any time and names the sound currently playing, so nobody has to memorize the legend.

## Sound design and haptic language

One sound grammar and one haptic grammar across every story, so a user who learns one story can read any other. Every sound and vibration must carry meaning; none is decoration.

**Sound grammar:**

| Data | Sound | Rule |
| --- | --- | --- |
| Temperature | Pitch of the lead melody | Higher = warmer than normal |
| Ice / snow cover | Sustained warm pad | Thins and quiets as cover shrinks |
| Sea level | Low drone | Rises slowly in pitch |
| CO₂ / other drivers | Background pulse | Faster = higher |
| Where change happens | Stereo position | Map left = left ear, right = right ear |
| Uncertainty / no data | Soft static | Never a pitched note |
| Time passing | Soft clock tick | One per decade |

**Two modes:** *Listen* snaps notes to a pleasant scale (musical, slightly rounded). *Analyze* turns off the snapping so small changes are heard exactly. Name this trade-off in the pitch.

**Layering:** at most two data layers at once; otherwise sound turns to mud. Use A/B compare ("play 1980, then 2023") instead of stacking.

**Haptic language:**

| Feeling | Meaning |
| --- | --- |
| Heartbeat pulse that speeds up | Temperature rising |
| Steady hum that weakens | Ice thinning |
| Sharp double tap | Record broken |
| Long fading buzz | Something disappeared (ice gone, forest burned) |
| Short tick | Border crossed |
| Single soft tap | Voice command understood |
| Strengthening pulse | Getting closer (metal detector mode) |

**Haptic-only mode:** with sound off, the vibrations still tell the story. Pitch it as a direction explored for deafblind users, not a solved problem: phone vibration carries rhythm and strength, not detail.

**Platform constraint:** browsers on iPhone don't allow websites to vibrate the phone. Demo on an Android phone and state that iOS needs a native app later.

## Psychology and audio rules

Research on blind users and on how sound captures attention changes four things in this plan: no background music during playback, one brisk voice, answers before descriptions, and the user always in control.

**How blind users listen and decide:**

| Finding | Design rule |
| --- | --- |
| Screen readers deliver information one item at a time, which raises cognitive load; spatial touch points let users anticipate outcomes and shift load onto touch | Touch is the main way to explore, not an add-on |
| Users build mental models from what their screen reader exposes, and expect the same layout every time | Gestures, sounds and positions never change between stories; Mauritius is always the home beacon |
| Blind and low-vision listeners have higher listening rates than sighted ones; most change default speech settings | Speech speed adjustable on the first screen, brisk default; one voice throughout, because familiarity with a voice offsets the loss at speed |
| Flat, monotone voices cause mental fatigue; added prosody raised engagement | Crisp for responses ("Entering Greenland"), more expressive for story moments and the finale, same voice |
| Over half of participants in one study disliked AI that opens with a full description instead of the answer | The Narrator's first sentence is the answer; detail only on "tell me more" |
| Richer AI descriptions raise believability, including of wrong ones; showing variation made users 4.9 times better at spotting unreliable claims | Narrator states its source ("from NASA's data" or "estimated from the image"); "How sure are you?" always works |
| Independence is control, choice and power; three control modes were proposed for navigation robots | Three app modes (below), always announced |
| Speech-driven browsing nearly doubled usability scores vs keyboard screen readers in a 24-person study | Voice stays the main input; keyboard remains as a full alternative |

**Three control modes:**

- **Tour:** the app plays a story start to finish; the user sits back.
- **Explore:** the user touches the map and asks questions; the app responds.
- **Command:** the user gives direct orders ("jump to 2012", "compare", "analyze mode").

The user can switch at any time, and the app says which mode it is in whenever it changes.

**How sound captures and holds attention:**

| Finding | Design rule |
| --- | --- |
| An unexpected sound in a steady background captures attention; the response fades with repetition | Keep the background steady so key moments stand out; at most 3 to 5 "record" events per story |
| Natural sounds (auditory icons) are learned faster than abstract tones (earcons) but are more irritating when repeated | Natural sounds only for rare events (ice cracking for an ice record); soft musical earcons for frequent feedback |
| Spearcons (speech sped up until it is almost a sound) are as learnable as speech | Use spearcons for menu items and mode names |
| Music with lyrics generally hurts cognitive performance; instrumental music has a small, uncertain effect, though people believe it helps | No lyrics anywhere |
| Lofi-specific evidence for focus is thin and mostly from sources that sell focus music | No lofi or background music under the data; the sonification is the music |
| Irrelevant sound disrupts memory for what you are listening to | Sonification pauses (or drops to one quiet held note) while the voice speaks, then resumes |

**Where background audio is allowed:** a very low, steady ambient bed on the welcome and menu screens only, never during data playback.

**Corrections to earlier sections:** wherever this plan says music "ducks" while the voice speaks, read it as "pauses or drops to one quiet note".

## Hearing what the eye misses

The challenge brief says auditory processing can reveal subtle patterns that the eye misses. Most of this plan translates what a visualization already shows, which serves accessibility but does not prove that listening can discover something. This section adds four ideas aimed at discovery, each with a test. None has been tried on real data yet, so treat each as a hypothesis until its test passes.

| Idea | What the listener hears | Why the eye misses it | Test (pass = keep it) |
| --- | --- | --- | --- |
| 1. Seasons as a heartbeat | Daily Arctic ice data played fast, one beat per year; weaker winters, deeper summer drops and a longer melt season show up as a beat drifting out of time | On a chart, 45 years of seasonal cycles overlap into a blur | Listeners hear, without a chart, that the later years differ from the early years, and can say how |
| 2. Finer than the colour scale | Pitch keeps finer steps than a colour scale, so two places with the same shade sound different | Extreme values often fall into one deep colour | Pick two values in the same colour bin; listeners correctly say which is higher |
| 3. Hearing instability | Wilder year-to-year swings give a rougher, less steady texture even when the trend looks smooth | Trend lines hide variability; averages look calm | Two series with the same trend but different variability; listeners pick the rougher one |
| 4. The proof moment | The judge hears a track with the screen dark and raises a hand when something changes | A change that is hard to spot visually | Judges raise a hand at or near the change; then the chart is revealed and shows it was hard to see |

**Rules for this section:**

- The music is allowed to feel; the voice only states facts. The Narrator never uses emotional words such as "alarming" or "devastating". The sound carries the emotion.
- If a test fails on real data, drop that idea instead of forcing it. A pitch claim like "listeners detected X" is allowed only if we ran the test and can state how many people took part.
- Ideas 1 to 3 need the real NASA data first, so build them after one gold story works end to end.

**Where it fits:** build it right after metal detector mode in the build order. Idea 4 is the priority because it can open the demo in about 20 seconds. If time runs short, cut ideas 1 to 3 before idea 4.

## Earth Symphony finale

A composed closing piece where the three gold stories enter like orchestra sections in cause-and-effect order, so the listener feels the climate system as one connected story. It is a performance, not an analysis layer, so the two-layer limit does not apply.

1. **Heat enters first:** the temperature melody alone, with a deep haptic thump as it begins.
2. **Ice responds:** the warm pad enters, then slowly thins as the melody climbs.
3. **Seas rise last:** the low drone enters and rises.
4. **Ice drops out:** the moment the pad goes silent, one long fading buzz.
5. **Present year, then two seconds of silence.** Let it land.

Length: about 60 to 90 seconds. Narration only at the start ("Forty-five years of our planet, in three voices") and the end (the current year). First item to cut if time runs short.

## App walkthrough

What a blind user experiences from opening the app to the end of a session. Every step works by voice, by keyboard and by touch.

1. **Open.** Chime. "Welcome to Earth, Out Loud. I have three stories: the planet heating, the ice melting, and the seas rising. Or name any NASA Earth visualization." Verbosity is set to Guide; "quieter" or "more detail" changes it.
2. **Choose a gold story: "the ice".** First time only, a 10-second legend: "This warm, soft sound is Arctic ice. Listen to it thin as the ice shrinks." Skippable with a tap.
3. **Orientation.** "A map of the Arctic, north at the centre. White shows sea ice, 1979 to today."
4. **Play.** Sound begins in 1979; the EIC animation plays in sync on screen with large live captions. A decade tick every ten years.
5. **Interrupt by voice.** The pad suddenly thins. "What just happened?" The sound pauses. "September 2012: the smallest Arctic ice ever recorded." Music returns.
6. **Jump.** "Take me to the biggest drop." Skip straight to that key moment.
7. **Touch.** Pause and put a finger on the map. Ticks at coastlines, names spoken on crossing, pitch under the finger.
8. **Find the change.** "Find the change." The pull sound guides the finger to the spot that lost most ice. Ping, double tap, one sentence with the number.
9. **Time travel.** Hold that spot, slide a second finger up: hear that one place across 45 years.
10. **Compare.** "Play 1980, then 2023." Two short clips back to back.
11. **Analyze mode.** "Analyze mode." Raw data, no musical smoothing.
12. **Live mode.** "Find me something about wildfires." The agent thinks aloud while it builds a new soundscape; legend plays; exploration works the same way.
13. **Your Year.** "Play since 2005." A lifetime of change.
14. **Finish.** 20-second spoken summary of what was explored, plus an option to share the track with its audio description.

## Risks and mitigations

The two risks that can sink the project are a wrong spoken fact and a demo that fails live; both have hard rules below.

| Risk | Why it matters | Mitigation | Owner |
| --- | --- | --- | --- |
| Narrator states a wrong fact | Instant credibility loss with NASA judges | Answers only from story file + fact sheet; every answer cites a number; "I don't know" allowed | Agent engineer + Red team |
| Live demo fails (Wi-Fi, mic, noise) | Judges see nothing | Pre-cache all gold stories; full keyboard control; recorded fallback video | Frontend + Red team |
| Legend reading fails on a new visualization | Wrong sound = misleading data | Confidence score → Simple mode; rehearse live mode only on 5–6 pre-tested visualizations | Frame analyst |
| Judges say we didn't sonify frames | Fails the brief | Frames drive the spatial layer in gold stories and everything in live mode | Data engineer |
| Latency between question and answer | Kills the magic | Scores pre-composed; a short waiting tone plays; answers under 15 s | Agent engineer |
| Blind users prefer screen reader to voice | Voice-only excludes them | Keyboard shortcuts + screen-reader labels on every control | Frontend |
| Accent recognition (Mauritian English) | Commands misheard | Test early; short fixed command phrases as backup | Agent engineer |
| iPhone can't vibrate from the web | Haptics vanish on iOS | Demo on Android; state iOS needs a native app | Frontend |
| Musical scale hides small changes | Data distortion | Analyze mode; name the trade-off in the pitch | Sound designer |
| Prior art (TouchingSpace, bviTouch, Chandra) | Looks unoriginal if unaddressed | Cite them as groundwork; our difference = time + any EIC visualization + grounded talk | Red team |
| Too much to build | Half-finished demo | Strict cut list below | Red team |

## Build order, cut list, validation and demo

Build the core loop on one gold story first; every later feature plugs into the same story file.

**Build order:**

1. Story file format agreed by all six (first hour).
2. One gold story (Arctic ice) end to end: data → score → playback synced to EIC frames.
3. Five voices on that story: icons, orientation, responsive, Narrator.
4. Touch: finger-to-pitch, borders, lift summary, home beacon.
5. Metal detector mode.
6. Second and third gold stories (reuse everything).
7. Live mode on 5–6 pre-tested visualizations.
8. Haptic language on Android.
9. Time travel, compare, Analyze mode.
10. Earth Symphony, Your Year, share.

**Cut order if behind (cut first → last):** share → Your Year → Symphony → two-finger compare → haptic-only mode → third gold story. Never cut: one gold story, the five voices, touch, metal detector mode, grounded Narrator.

**Validation:**

- [ ] Book 15–30 minutes with a visually impaired tester before the event (for example via the Lois Lagesse Trust Fund)
- [ ] Test: can they find the biggest change in metal detector mode in under 30 seconds, unaided?
- [ ] Test: can they explain what the sound meant after one listen, with the legend?
- [ ] Capture one quote (with permission) for the video
- [ ] Red team fact-checks every Narrator answer for the gold stories
- [ ] Voice commands tested with Mauritian-accented speakers

**Demo script (90 seconds):**

1. Black screen. The Earth Symphony plays. Reveal: "That was 45 years of our planet."
2. A judge names any EIC visualization. The agent finds it, thinks aloud, and plays it.
3. A blind tester runs metal detector mode and finds the hotspot by touch.
4. "What happened here?" One true answer with a number.
5. Close on the one-liner.

## Research basis and sources

Each design choice above rests on work already tested with blind and low-vision users.

| Finding | Used for | Source |
| --- | --- | --- |
| Sonified NASA data gave significant self-reported learning gains across 3,184 sighted and BLV participants | Core premise | [A Universe of Sound, Arcand et al. 2024](https://pdf.arxiv.org/pdf/2403.18082) |
| BLV users showed higher engagement than sighted users; one-size-fits-all sonification wasn't helpful | Verbosity levels | [Chandra sonification Q&A](https://chandra.si.edu/blog/node/797), [Chandra blog](https://chandra.harvard.edu/blog/index.html/node/797) |
| Sound icons for events, sonification for continuous values, speech for alerts; blind testers praised sound + description together | Five voices | [PhET multimodal simulation review](https://a11y-paradise.onrender.com/reviews/69c495868aab5c4b101667b4) |
| Proximity sound, boundary vibration + spoken name, agent grounded in what's under the finger (14 BLV participants) | Touch, metal detector mode, breadcrumbs | [TouchingSpace, UC Santa Cruz 2026](https://arxiv.org/pdf/2609.36404) |
| Blind and sighted users learned maps equally well from a vibro-audio touchscreen map | Touch the planet | [Palani, Fink & Giudice 2021](https://umaine.edu/vemi/?p=3136) |
| Audio + built-in vibration beat audio alone for judging direction | Haptic language | [VCU audio-tactile map](https://blogs.vcu.edu/dtpawluk/?p=654) |
| "Describe what you see" is audio description's first rule | Describe before interpreting | [Audio description tips, adapted from DCMP](https://sdccd.instructure.com/courses/2374672/modules/items/39141924) |
| STEM descriptions: brief, clear, data-focused, drill-down | Orientation + drill-down | [Penn State: describing STEM images](https://courses.worldcampus.psu.edu/welcome/acc100/001/content/04_lesson/03_page.html) |
| Colour-to-tone image exploration by touch already exists on iOS | Prior art to cite | [bviTouch on AppleVis](https://applevis.com/comment/71950) |

Challenge brief: [The Earth Information Jukebox, NASA Space Apps 2026](https://www.spaceappschallenge.org/2026/challenges/the-earth-information-jukebox/).

Sources for Building on MyEarthObserver: [MyEarthObserver repository (Team NIXIT)](https://github.com/Team-NIXIT/MyEarthObserver) and [GIBS API docs: colormaps, legends and time](https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/).

Sources for Ideas from NASA Openscapes: [Context Data project (NASA Cloud Hackathon 2021)](https://github.com/NASA-Openscapes/nch2021-projects-contexdata) and [Upwelling project (NASA Hackweek 2021)](https://github.com/NASA-Openscapes/nhw21-projects-upwelling).

**Sources for the psychology and audio rules:**

- [Screen readers and web cognition (Bristol)](https://research-information.bris.ac.uk/en/publications/the-influence-of-screen-readers-on-web-cognition/) and [TapNav spatiotactile screen reader](https://arxiv.org/html/2510.14267v2)
- [Listening rates of blind and low-vision people (Bragg et al., CHI 2018)](https://wildlab.cs.washington.edu/Publications_files/Bragg_CHI2018.pdf)
- [Intelligibility of fast synthesized speech](https://a11y-paradise.onrender.com/reviews/69d7d9bcaa016bb4026815ec) and [VoxVista: prosody for blind listeners](https://digitalcommons.odu.edu/computerscience_fac_pubs/442)
- [Say It My Way: Be My AI study](https://www.digitaltrends.com/?p=6018239), [surfacing variations in AI descriptions](https://a11y-paradise.onrender.com/reviews/69abb5b09a729255f81bc7d6) and [how blind people verify AI errors](https://arxiv.org/html/2408.06546v1)
- [Beyond Omakase: shared control](https://arxiv.org/html/2503.21997v2) and [speech-driven browsing study](https://a11y-paradise.onrender.com/reviews/69c05ac9982c4bd9aedb1a71)
- [Attentional capture by deviant sounds](https://knowledge.lancashire.ac.uk/id/eprint/15432/) and [habituation of the orienting response](https://pmc.ncbi.nlm.nih.gov/articles/PMC3306568)
- [Earcons vs auditory icons](https://ideas.repec.org/a/igg/jthi00/v14y2018i4p95-109.html) and [spearcon learnability](https://repository.gatech.edu/entities/publication/8cf42420-1aaf-4a59-9ccb-7c7458346a9d)
- [Music with lyrics and cognitive tasks (2023)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10162369/) and [Lofi vs functional music (commercial source, treat with caution)](https://www.brain.fm/blog/lofi-vs-functional-music-focus)
