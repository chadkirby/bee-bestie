import {default as games} from '../../../workers/initialization/src/games.json' with {type: 'json'};
import { PhonotacticScorer } from '../src/phonotactic.js';

const scorer = await PhonotacticScorer.load();
const executionTimes: Record<string, number> = {};
for (const game of games) {
  const maxAnswerLength = Math.max(...game.answers.map((w) => w.length));
  const id = `${game.centerLetter}/${game.outerLetters.join('')}`;
  const startTime = performance.now();
  const viableWordCount = scorer.countViableWords({
    pool: game.outerLetters.join(''),
    center: game.centerLetter,
    minLen: 4,
    maxLen: 7
  });

  const endTime = performance.now();
  executionTimes[id] = endTime - startTime;
  console.log(id, game.date, 'execution time', `${(endTime - startTime).toFixed()}ms`, 'longest answer', maxAnswerLength, 'viable words', viableWordCount);
}

console.log(executionTimes);
