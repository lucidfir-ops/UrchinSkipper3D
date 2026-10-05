# Whistle only: recorded diver voices removed — October 5, 2026

Source: designer notes of October 5 (second batch, `feedback/10-5/`): "get rid of the voice calls and just go with the whistle". This supersedes the same day's voice hails ([record](diver-calls-2026-10-05.md)). The Bible §3 audio entry is updated in place.

## Change

Commit 8d8250f is reverted:
- `src/diver-calls.js`;
- voice loading and playback in `src/audio.js`;
- the `voice` field on crew in `src/career-data.js`;
- the 22 clip files and `public/assets/voices/SOURCES.md`;
- `tests/diver-calls.test.js`.

A diver surfacing within sound range whistles again, at a volume that falls linearly with distance and is silent at 65 m, exactly as before October 5. The clips remain in the repository history should they ever be wanted.

## Evidence

`tests/in-world-cues.test.js` checks that no voice assets or call module ship and that surfacing maps to the whistle. The full unit suite passes.

## Limits

Not listened to on a device after the change; the whistle path is the pre-October 5 code.
