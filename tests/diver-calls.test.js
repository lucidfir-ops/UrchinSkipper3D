import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { CREW } from '../src/career-data.js';
import { CALL_RANGE, VOICE_CLIPS, diverVoice, surfaceCall, voiceRate } from '../src/diver-calls.js';

test('October 5: close surfaced divers call out by voice, distant ones whistle, both fade with distance', () => {
  const ada = { id: 0, crewId: 'ada' };
  const near = surfaceCall(ada, 10, 65, null, () => 0),
    edge = surfaceCall(ada, CALL_RANGE, 65, null, () => 0),
    far = surfaceCall(ada, 50, 65, null, () => 0);
  assert.equal(near.kind, 'voice');
  assert.equal(edge.kind, 'voice');
  assert.equal(far.kind, 'whistle');
  assert(near.gain > edge.gain && edge.gain > far.gain && far.gain > 0);
  assert.equal(surfaceCall(ada, 65, 65), null, 'inaudible beyond sound range');
});

test('voices follow each character, never repeat the previous clip and have shipped CC0 files', () => {
  for (const c of CREW) assert(['female', 'male', 'any'].includes(c.voice), c.id);
  assert.equal(diverVoice({ crewId: 'ada' }), 'female');
  assert.equal(diverVoice({ crewId: 'milo' }), 'male');
  assert.equal(diverVoice({ id: 1 }), 'any');
  const milo = { crewId: 'milo' };
  for (let i = 0; i < 20; i++) {
    const call = surfaceCall(milo, 5, 65, 'call-hey-male-2', () => i / 20);
    assert(VOICE_CLIPS.male.includes(call.clip));
    assert.notEqual(call.clip, 'call-hey-male-2');
  }
  assert(VOICE_CLIPS.female.includes(surfaceCall({ crewId: 'nell' }, 5, 65).clip));
  assert.notEqual(voiceRate({ crewId: 'ada' }), voiceRate({ crewId: 'nell' }));
  const sources = readFileSync('public/assets/voices/SOURCES.md', 'utf8');
  for (const clip of Object.values(VOICE_CLIPS).flat()) {
    for (const ext of ['ogg', 'mp3'])
      assert(existsSync(`public/assets/voices/${clip}.${ext}`), clip);
    assert(sources.includes('`' + clip + '`'), `${clip} source recorded`);
  }
  assert.match(sources, /publicdomain\/zero\/1\.0/);
});
