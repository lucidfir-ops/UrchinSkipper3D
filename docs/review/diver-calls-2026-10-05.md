# Diver hails: voices when close, whistles when far — October 5, 2026

Source: designer notes, October 5, 2026 ("realistic voice sounds of someone saying Heeyyy ooh! … call if close and whistle if far. volume reduces with distance"). The designer chose freely licensed recordings. The Bible §3 audio entry is updated in place.

## Change

- On surfacing, a diver within 35 m of the boat calls out using one of 11 recorded hails; beyond 35 m (up to the existing 65 m sound range) they whistle as before. Both fall off linearly with distance, inaudible at 65 m.
- Pools: female for Ada, Nell and Inez; male for Milo, Roy and Dave; R. Robinson and Pat Murphy (described with "they" in their bios) draw from both pools. Each diver has a small fixed pitch offset (0.94–1.06) so two divers sharing a pool sound different. A diver never repeats their previous clip twice in a row.
- Clips (Opus Ogg + MP3 fallback, 256 KB total) are fetched after the first user gesture so startup is unaffected. A clip not yet loaded falls back to the whistle.
- `src/diver-calls.js` (selection), `BoatAudio.loadVoices/call` (`src/audio.js`), `voice` field on `CREW` (`src/career-data.js`).

## Sources

All 11 shipped clips are CC0 1.0 recordings from freesound.org. Each licence was verified on its sound page. `public/assets/voices/SOURCES.md` records the page, author, words, voice, cut times and processing (mono, 90 Hz high-pass, −16 LUFS, limiter −1.5 dBFS). Freesound's public HQ previews were used, since the originals need a login; it is the same recording under the same licence. Left out: a pirate character voice, a distorted "Ahoy", a German "Hallo", a whoop cut next to a name, and wordless herding calls.

## Evidence

- `tests/diver-calls.test.js`: voice inside 35 m and whistle outside, monotonic gain, silence at the range limit, per-character pools, no immediate repeat, a distinct pitch per diver, and every shipped clip existing in both formats with a recorded source.
- Production build in Chromium (Deck GPU) and Firefox (Playwright): all 11 clips decoded (e.g. Yoo-hoo 1.14 s), and a voice call played through the Phaser sound manager with no page errors.

## Limits

Nobody has listened to the clips. They were selected by an agent from uploader descriptions, spectrograms and loudness measurements. Female clips with actual words are scarce: only "Yoo-hoo" is a clear word; the others are a shouted "Heyyy"-like vowel, a short shout and a distant "Yaaah". The designer should listen and say which to drop. Recording their own calls would replace these cleanly.
