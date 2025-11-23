import {default as games} from '../../../workers/initialization/src/games.json' with {type: 'json'};
import { PhonotacticScorer } from '../src/phonotactic.js';
import * as fs from 'node:fs';

const scorer = await PhonotacticScorer.load();

interface GameData {
  date: string;
  id: string;
  viableWordCount: number;
  answerCount: number;
  ratio: number;
  maxAnswerLength: number;
  syllableCount: number;
}

const data: GameData[] = [];

console.log(`Processing ${games.length} games...`);

for (const game of games) {
  const maxAnswerLength = Math.max(...game.answers.map((w) => w.length));
  const id = `${game.centerLetter}/${game.outerLetters.join('')}`;
  const pool = game.outerLetters.join('') + game.centerLetter;

  const viableWordCount = scorer.countViableWords({
    pool: game.outerLetters.join(''),
    center: game.centerLetter,
    minLen: 4,
    maxLen: 7,
  });

  const syllableCount = scorer.countValidSyllables(pool);
  const answerCount = game.answers.length;
  const ratio = answerCount / viableWordCount;

  data.push({
    date: game.date,
    id,
    viableWordCount,
    answerCount,
    ratio,
    maxAnswerLength,
    syllableCount,
  });

  if (data.length % 10 === 0) {
    process.stdout.write('.');
  }
}
console.log('\nDone processing.');

// Calculate Pearson correlation between syllableCount and ratio
const n = data.length;
const sumX = data.reduce((acc, d) => acc + d.syllableCount, 0);
const sumY = data.reduce((acc, d) => acc + d.ratio, 0);
const sumXY = data.reduce((acc, d) => acc + d.syllableCount * d.ratio, 0);
const sumX2 = data.reduce((acc, d) => acc + d.syllableCount ** 2, 0);
const sumY2 = data.reduce((acc, d) => acc + d.ratio ** 2, 0);

const numerator = n * sumXY - sumX * sumY;
const denominator = Math.sqrt(
  (n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2)
);
const correlation = numerator / denominator;

console.log(
  `\nCorrelation (Syllable Count vs Difficulty Ratio): ${correlation.toFixed(4)}`
);

const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Viable Words Analysis</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    .chart-container { position: relative; height: 40vh; width: 90vw; margin-bottom: 50px; }
  </style>
</head>
<body>
  <h1>Viable Words Analysis</h1>

  <div class="chart-container">
    <canvas id="viableChart"></canvas>
  </div>

  <div class="chart-container">
    <canvas id="ratioChart"></canvas>
  </div>

  <div class="chart-container">
    <canvas id="syllableChart"></canvas>
  </div>

  <script>
    const rawData = ${JSON.stringify(data)};

    // Sort by date
    rawData.sort((a, b) => new Date(a.date) - new Date(b.date));

    const dates = rawData.map(d => d.date);

    // Chart 1: Viable Word Counts
    new Chart(document.getElementById('viableChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Viable Word Count',
          data: rawData.map(d => ({x: d.date, y: d.viableWordCount})),
          backgroundColor: 'rgba(54, 162, 235, 0.5)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Viable Word Counts per Game' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const d = rawData[context.dataIndex];
                return \`\${d.id}: \${d.viableWordCount} viable words (Max Len: \${d.maxAnswerLength})\`;
              }
            }
          }
        },
        scales: {
          x: { type: 'category', labels: dates },
          y: { beginAtZero: true, title: { display: true, text: 'Count' } }
        }
      }
    });

    // Chart 2: Difficulty Ratio
    new Chart(document.getElementById('ratioChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Difficulty Ratio (Answers / Viable)',
          data: rawData.map(d => ({x: d.date, y: d.ratio})),
          backgroundColor: 'rgba(255, 99, 132, 0.5)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Difficulty Ratio (Higher is Easier)' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const d = rawData[context.dataIndex];
                return \`\${d.id}: Ratio \${d.ratio.toFixed(4)} (\${d.answerCount}/\${d.viableWordCount})\`;
              }
            }
          }
        },
        scales: {
          x: { type: 'category', labels: dates },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Ratio (Log Scale)' }
          }
        }
      }
    });

    // Chart 3: Difficulty Ratio vs Syllable Count
    new Chart(document.getElementById('syllableChart'), {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Difficulty vs Syllable Count',
          data: rawData.map(d => ({x: d.syllableCount, y: d.ratio})),
          backgroundColor: 'rgba(75, 192, 192, 0.5)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: 'Difficulty Ratio vs Syllable Count' },
          tooltip: {
            callbacks: {
              label: (context) => {
                const d = rawData[context.dataIndex];
                return \`\${d.id}: Ratio \${d.ratio.toFixed(4)} (Syllables: \${d.syllableCount})\`;
              }
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: { display: true, text: 'Syllable Count' }
          },
          y: {
            type: 'logarithmic',
            title: { display: true, text: 'Difficulty Ratio (Log Scale)' }
          }
        }
      }
    });
  </script>
</body>
</html>
`;

fs.writeFileSync('viable-words-plot.html', html);
console.log('Generated viable-words-plot.html');
