import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const dir = '<evidence>';
const json = name => JSON.parse(readFileSync(`${dir}/${name}`, 'utf8'));
const requests = phase => readFileSync(`${dir}/${phase}-requests.jsonl`, 'utf8').trim().split('\n').map(JSON.parse);
for (const phase of ['before', 'after']) {
  const model = json(`${phase}-models.json`).find(model => model.id === 'qa/qa-model');
  assert.deepEqual(model.thinkingOptionIds, phase === 'before' ? ['low', 'medium'] : ['default', 'low', 'medium']);
  assert.equal(model.defaultThinkingOptionId, phase === 'before' ? null : 'default');
  const expected = phase === 'before' ? ['medium', null] : ['medium', null, null];
  assert.deepEqual(requests(phase).map(({ body }) => body.reasoning_effort ?? null), expected);
  assert.equal(json(`${phase}-send-default.json`).status, 'completed');
  const native = JSON.parse(json(`${phase}-native-session.json`)[0].model);
  if (phase === 'before') assert.equal(native.variant, 'default');
  else assert.equal(Object.hasOwn(native, 'variant'), false);
}
assert.equal(Object.hasOwn(JSON.parse(json('after-created-native-session.json')[0].model), 'variant'), false);
assert.equal(json('resume-send.json').status, 'completed');
assert.deepEqual(requests('resume').map(({ body }) => body.reasoning_effort ?? null), [null]);
assert.equal(Object.hasOwn(JSON.parse(json('resume-native-session.json')[0].model), 'variant'), false);
console.log('PASS: CLI options, medium→Default requests, native variant omission, Default creation, and resume.');
