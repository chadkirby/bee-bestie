import { assert, test, suite, describe } from 'vitest';
import { PhonotacticScorer } from '../src/phonotactic.js';

suite('PhonotacticScorer', () => {
  const dictionary = [
    'apple',
    'grand',
    'grow',
    'bond',
    'window',
    'iron',
    'apron',
    'dragoon',
    'condo',
    'wagon',
    'agron',
  ];
  const scorer = new PhonotacticScorer(dictionary);

  test('scores "dragon" as viable (real word)', () => {
    const word = 'dragon';
    const score = scorer.score(word);
    const viable = scorer.isViable(word);
    console.log(`Toy Dragon: score=${score}, viable=${viable}`);

    assert.isTrue(viable, `Expected ${word} to be viable`);
    assert.isAbove(score, -4.0, `Expected ${word} score to be > -4.0`);
  });

  test('scores "grondo" as viable (pronounceable pseudoword)', () => {
    const word = 'grondo';
    const score = scorer.score(word);
    const viable = scorer.isViable(word);

    assert.isTrue(viable, `Expected ${word} to be viable`);
    assert.isAbove(score, -4.0, `Expected ${word} score to be > -4.0`);
  });

  test('scores "pgrnod" as not viable (garbage)', () => {
    const word = 'pgrnod';
    const score = scorer.score(word);
    const viable = scorer.isViable(word);

    assert.isFalse(viable, `Expected ${word} to NOT be viable`);
    assert.isBelow(score, -8.0, `Expected ${word} score to be < -8.0`);
  });

  test('counts valid syllables', () => {
    // dragon -> dra, gon
    // grondo -> gron, do
    const count = scorer.countValidSyllables('dragondo');
    // Should find at least 'dra', 'gon', 'gron', 'do'
    assert.isAtLeast(count, 4, 'Expected count to be at least 4');
  });

  test('can generate random viable words', () => {
    const word = scorer.getRandomViableWord({
      pool: 'dragon',
      center: 'o',
      minLen: 4,
      maxLen: 8,
    });
    assert.isString(word);
    assert.include(word!, 'o');
    assert.isTrue(scorer.isViable(word!), `Expected ${word} to be viable`);
  });

  test('random generation respects constraints', () => {
    for (let i = 0; i < 10; i++) {
      const word = scorer.getRandomViableWord({
        pool: 'dragon',
        center: 'o',
        minLen: 5,
        maxLen: 6,
      });
      if (word) {
        assert.isAtLeast(word.length, 5);
        assert.isAtMost(word.length, 6);
        assert.include(word, 'o');
      }
    }
  });
});

suite('can load pre-trained model', async () => {
  const loadedScorer = await PhonotacticScorer.load();
  assert.instanceOf(loadedScorer, PhonotacticScorer);

  test('dragon', () => {
    assert.ok(
      loadedScorer.isViable('dragon'),
      'Expected dragon to be viable with loaded model'
    );
  });

  test('pgrnod', () => {
    assert.notOk(
      loadedScorer.isViable('pgrnod'),
      'Expected pgrnod to NOT be viable with loaded model'
    );
  });

  test('grondo', () => {
    assert.ok(loadedScorer.isViable('grondo'), 'grondo');
  });

  test('occupinup', () => {
    assert.ok(loadedScorer.isViable('occupinup'), 'occupinup');
  });

  test('occupprrrrgpinup', () => {
    assert.notOk(
      loadedScorer.isViable('occupprrrrgpinup'),
      `occupprrrrgpinup score: ${loadedScorer.score('occupprrrrgpinup')}`
    );
  });
  test('pxdingle is not viable', () => {
    assert.notOk(loadedScorer.isViable('pxdingle'), 'pxdingle');
  });

  // skouth is viable
  test('skouth', () => {
    assert.ok(loadedScorer.isViable('skouth'), 'skouth');
  });

  // skoukh is not viable
  test('skpout', () => {
    const viable = loadedScorer.isViable('skpout');
    console.log(
      `Full Skpout: viable=${viable}, score=${loadedScorer.score('skpout')}`
    );
    assert.notOk(viable);
  });
});

suite('can generateViableWords', async () => {
  const loadedScorer = await PhonotacticScorer.load();

  test('generateViableWords', () => {
    const generator = loadedScorer.generateViableWords({
      pool: 'grandpop',
      center: 'r',
      minLen: 4,
      maxLen: 6,
    });

    const words = Array.from(generator);
    console.log(`Generated ${words.length} words`);

    assert.isArray(words);
    assert.isNotEmpty(words);

    // Check that all generated words contain the center letter 'r'
    words.forEach((w) => assert.match(w, /r/));
    // check that no words include other letters
    words.forEach((w) => assert.match(w, /^[grandpop]+$/));

    // Check determinism by running count
    const count = loadedScorer.countViableWords({
      pool: 'grandpop',
      center: 'r',
      minLen: 4,
      maxLen: 6,
    });
    assert.equal(count, words.length);
  });

  test('generateViableWords list', () => {
    const generator = loadedScorer.generateViableWords({
      pool: 'ad',
      center: 'r',
      minLen: 4,
      maxLen: 6,
    });

    const words = Array.from(generator);
    assert.deepEqual(words.sort(), [
      'aadar',
      'aadara',
      'aadra',
      'aara',
      'aara',
      'aarad',
      'aarada',
      'aarada',
      'aarar',
      'aarara',
      'aarara',
      'aarda',
      'aardar',
      'adadar',
      'adar',
      'adara',
      'adarda',
      'addara',
      'addra',
      'adra',
      'adra',
      'adrada',
      'adrara',
      'arad',
      'arada',
      'aradar',
      'aradra',
      'arar',
      'arara',
      'arda',
      'ardar',
      'arra',
      'arrada',
      'arrara',
      'dadar',
      'dadara',
      'dara',
      'darada',
      'darara',
      'darda',
      'rada',
      'radada',
      'radar',
      'radara',
      'radra',
      'rara',
      'rarada',
    ]);
  });
});
