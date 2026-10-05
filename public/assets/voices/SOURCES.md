# Diver hail voice clips — sources and licences

**In the game (October 5, 2026):** male — call-hey-far-male-1/2/3, call-heyoh-male-1, call-hey-male-2/3, call-heeey-long-male-1; female — call-yoohoo-female-1, call-heyyy-female-1, call-hey-female-2, call-yaah-female-1. The other clips below were processed but left out (character/pirate voice, German word, distorted laptop mic, wordless herding call, name-cut whoop); they are not shipped.

Collected October 5, 2026. Every source was checked on its own freesound.org sound page; each page's licence link is `http://creativecommons.org/publicdomain/zero/1.0/` (Creative Commons 0). No CC-BY / CC-BY-NC material is included. Attribution is not legally required for CC0, but authors are listed here.

**Source audio caveat:** files were taken from freesound's public HQ previews (`https://cdn.freesound.org/previews/...-hq.mp3`, 128 kbps MP3), not the original uploads (those need a login). Same recording, CC0 applies equally; quality is ample for 48 kbps game clips. Raw previews are in `../raw/fsNNNNNN.mp3`.

**Processing (all files):** cut the segment listed below from the raw preview → downmix to mono → 90 Hz high-pass → 12 ms fade-in and the listed fade-out → measured EBU R128 integrated loudness, applied static gain to −16 LUFS → `alimiter` at −1.5 dBFS (no clip reached it hard; final true peaks −1.3 to −9.2 dBTP) → 48 kHz → `.ogg` = Opus 48 kbps mono, `.mp3` = LAME 64 kbps CBR mono 44.1 kHz. No pitch-shifting, EQ beyond the high-pass, reverb or noise reduction was added by us.

**Verification:** no listening was possible. Each clip was checked by spectrogram (voiced harmonic stacks present, no silent/noise-only clips), by ebur128 (all −16.0 to −16.3 LUFS) and by short-window RMS envelopes to place word boundaries. Words are taken from the uploader's description; where the uploader did not say what was shouted, that is stated. A human listen-check is still needed, especially for `call-ahoy-male-1`, `call-wooo-male-1` (cut boundaries placed from energy dips) and the two `kulning` clips.

| File (.ogg + .mp3) | Duration | Sound page (licence shown) | Title | Author | Spoken | Voice | Segment of source (s) | Fade-out | Notes |
|---|---|---|---|---|---|---|---|---|---|
| `call-hey-far-male-1` | 0.93 s | https://freesound.org/people/ValentinPetiteau/sounds/557375/ | Voice_Man_hey_calling_far_away_shout.wav | ValentinPetiteau | "Hey!" (calling to someone far away) | male (stated: "A man") | 1.38–2.30 | 0.15 s | Genuine "calling far away" delivery; best match to the brief. |
| `call-hey-far-male-2` | 0.95 s | https://freesound.org/people/ValentinPetiteau/sounds/557375/ | Voice_Man_hey_calling_far_away_shout.wav | ValentinPetiteau | "Hey!" (calling to someone far away) | male (stated: "A man") | 4.06–5.00 | 0.15 s | Genuine "calling far away" delivery; best match to the brief. |
| `call-hey-far-male-3` | 1.08 s | https://freesound.org/people/ValentinPetiteau/sounds/557375/ | Voice_Man_hey_calling_far_away_shout.wav | ValentinPetiteau | "Hey!" (calling to someone far away) | male (stated: "A man") | 14.88–15.95 | 0.15 s | Genuine "calling far away" delivery; best match to the brief. |
| `call-heyoh-male-1` | 1.31 s | https://freesound.org/people/qubodup/sounds/859347/ | Yelling Eyoh in Empty Parking Garage | qubodup | "Eyoh!" / "Hey-oh!" (garage reverb tail, faded out) | male (not stated; inferred from pitch) | 0.00–1.30 | 0.70 s | Strong garage reverb; tail shortened with 0.7 s fade. |
| `call-hey-male-1` | 1.56 s | https://freesound.org/people/wayneoutthere/sounds/353137/ | 01_hey.wav | wayneoutthere | "Hey!!" (gruff, pirate-ish) | male (not stated; inferred from pitch) | 0.05–1.60 | 0.30 s | Gruff character voice. |
| `call-hey-male-2` | 0.76 s | https://freesound.org/people/Fabrizio84/sounds/457973/ | Me Saying "Hey" | Fabrizio84 | "Hey!" (loud) | male (inferred from uploader name and pitch; not stated) | 0.30–1.05 | 0.15 s | Close-mic; take 1 (0.30–1.05) and take 4 (8.70–9.45). |
| `call-hey-male-3` | 0.76 s | https://freesound.org/people/Fabrizio84/sounds/457973/ | Me Saying "Hey" | Fabrizio84 | "Hey!" (loud) | male (inferred from uploader name and pitch; not stated) | 8.70–9.45 | 0.15 s | Close-mic; take 1 (0.30–1.05) and take 4 (8.70–9.45). |
| `call-heeey-long-male-1` | 2.31 s | https://freesound.org/people/befreezz/sounds/403908/ | man hey sing loud.flac | befreezz | "Heeeey" (long sung-shout; original is 4.7 s, cut at 2.3 s with fade) | male (stated) | 0.50–2.80 | 0.60 s | Close-mic indoor, no room; sustained note cut with fade. |
| `call-ahoy-male-1` | 0.73 s | https://freesound.org/people/dr_dig1/sounds/789588/ | Pirate Saying Ahoy Matey | dr_dig1 | "Ahoy" (the word "matey" cut off; boundary chosen from the energy dip at 1.53 s) | male (not stated; inferred from pitch) | 0.82–1.54 | 0.06 s | Laptop mic, slightly distorted/clipped original; theatrical pirate voice. |
| `call-wooo-male-1` | 1.94 s | https://freesound.org/people/BalancedEnergy10/sounds/266716/ | Sophie Sugar - Wooooo! - Seascraper + Sugar - Mountain Plateau - High Elevation Perfect - Public Affection - 7PM - Romance - 2015 - BC - (B).wav | BalancedEnergy10 | "Woooooo!" (final word only; the name "Sophie Sugar" is cut out — boundary from energy dip at 3.70 s) | male (stated) | 3.71–5.64 | 0.15 s | Outdoor mountain recording; male falsetto-ish whoop. |
| `call-hallo-hey-male-1` | 2.26 s | https://freesound.org/people/LG/sounds/718048/ | 20231228 - Düsseldorf metro guard hallo | LG | "Hallo! … Hey!" (German; reads as "Hello!… Hey!") | male (not stated; inferred from pitch) | 0.00–2.25 | 0.25 s | Metro platform background noise audible under voice; German word. |
| `call-yoohoo-female-1` | 1.15 s | https://freesound.org/people/KyriaT/sounds/843205/ | KyriaT_Yoohoo | KyriaT | "Yoo-hoo!" | female (stated) | 0.62–1.76 | 0.10 s | Clean phone recording; cheerful sing-song. |
| `call-heyyy-female-1` | 2.21 s | https://freesound.org/people/annatabernero/sounds/219666/ | 19-yeard-old Girl Shouting | annatabernero | Sustained shouted vowel, "Heeyyy/Aaaay"-like; exact word not stated by uploader | female (stated, 19 years old) | 0.00–2.20 | 0.30 s | Very clean and loud; sustained ~2 s. |
| `call-hey-female-2` | 0.68 s | https://freesound.org/people/slamaxu/sounds/509882/ | female_shout_01.wav | slamaxu | Short shouted syllable ("Hey!"/"Ah!"-like); exact word not stated by uploader | female (stated) | 0.03–0.70 | 0.15 s | Clean, short. |
| `call-yaah-female-1` | 1.27 s | https://freesound.org/people/qubodup/sounds/737957/ | Yaaaaah | qubodup | "Yaaaah!" (real distant outdoor shout) | female (stated) | 0.00–1.27 | 0.20 s | Park background noise, distant voice — realistic but the noisiest clip. |
| `call-kulning-female-1` | 2.51 s | https://freesound.org/people/ZebNilsson/sounds/787732/ | Kauk Swedish ancient herding call | ZebNilsson | Wordless high sung call (kulning); not a word | female (stated) | 0.80–3.30 | 0.60 s | Very quiet original (+24–27 dB gain), so room/hiss floor is raised; 2.5 s cut from a ~3.5 s call with 0.6 s fade. |
| `call-kulning-female-2` | 2.51 s | https://freesound.org/people/ZebNilsson/sounds/787732/ | Kauk Swedish ancient herding call | ZebNilsson | Wordless high sung call (kulning); not a word | female (stated) | 6.00–8.50 | 0.60 s | Very quiet original (+24–27 dB gain), so room/hiss floor is raised; 2.5 s cut from a ~3.5 s call with 0.6 s fade. |

## Licence (identical for every source)

CC0 1.0 Universal (Public Domain Dedication) — the sound page links http://creativecommons.org/publicdomain/zero/1.0/. Verified on each sound page listed above on October 5, 2026.

## Uploader descriptions (verbatim summaries)

- **557375** "Voice_Man_hey_calling_far_away_shout.wav" by ValentinPetiteau: A man calling someone with "hey" (Zoom H5). Five separate outdoor "hey!" calls in one 16.8 s file.
- **859347** "Yelling Eyoh in Empty Parking Garage" by qubodup: Yelling "eyoh!"/"e-oh" in an empty underground parking garage; uploader noise-reduced and normalised.
- **353137** "01_hey.wav" by wayneoutthere: Pirate yelling "Hey!!"
- **457973** "Me Saying "Hey"" by Fabrizio84: Me saying "Hey". Four takes.
- **403908** "man hey sing loud.flac" by befreezz: Singing (shout-like) "hey" slowly, iPhone 4 mic, no processing.
- **789588** "Pirate Saying Ahoy Matey" by dr_dig1: Just me saying ahoy Matey as a Pirate; MacBook internal mic.
- **266716** "Sophie Sugar - Wooooo! - Seascraper + Sugar - Mountain Plateau - High Elevation Perfect - Public Affection - 7PM - Romance - 2015 - BC - (B).wav" by BalancedEnergy10: A Canadian man yells a name at high altitude for the world below to hear (outdoor, mountain plateau).
- **718048** "20231228 - Düsseldorf metro guard hallo" by LG: A platform guard shouts "hello, hey!" (German "Hallo") at someone blocking a metro door; Sony PCM-D50.
- **843205** "KyriaT_Yoohoo" by KyriaT: Female saying yoohoo; own voice, iPhone.
- **219666** "19-yeard-old Girl Shouting" by annatabernero: Young girl (19) shouting, iPhone 4S, FreeSound Conference at UPF.
- **509882** "female_shout_01.wav" by slamaxu: female shouting sound effect
- **737957** "Yaaaaah" by qubodup: A woman shouting "yaaah" in a park after a concert. Quite noisy, quite distant. Zoom H2n.
- **787732** "Kauk Swedish ancient herding call" by ZebNilsson: Uploader's daughter doing "kauk"/"kulning", the high-pitched Scandinavian herding call for calling livestock across distance.

## Considered and rejected

- freesound 852535 "EarlyFiles-TSR-Yell-Female Yell 2-Single Yell-Oh" (CC0) — uploader states it is his own male voice pitched up; not a real female voice.
- freesound 55052 "ferry_crew_shouts.wav" (CC0) — harbour ambience dominates; voices unusable.
- freesound 219657 / 219686 (CC0) — child or very young voices, screams rather than hails.
- freesound 593436, 856533 (CC0) — pitch-shifted / generated voices.
- Wikimedia Commons pronunciation files ("Ahoy", "Cooee", "Yoo hoo", "Hello") — the ones checked are CC BY-SA 4.0 (e.g. "EN-AU ck1 cooee.ogg"), and they are spoken pronunciations, not hails.
- OpenGameArt / Kenney packs were not used: no CC0 human hail/shout recordings matching the brief were found in time; Kenney voice packs are announcer-style.
