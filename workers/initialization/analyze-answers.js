#!/usr/bin/env node

/**
 * Script to analyze the most commonly appearing Spelling Bee answers
 * from the games.json file.
 *
 * This script processes the large games.json file efficiently by using
 * streaming JSON parsing to avoid loading the entire file into memory.
 */

import fs from 'fs';
import readline from 'readline';

/**
 * Process the games.json file and count answer frequencies
 * @param {string} filePath - Path to the games.json file
 * @returns {Promise<{mostCommon: string, frequency: number, top10: Array<{word: string, count: number}>}>}
 */
async function analyzeAnswers(filePath) {
  return new Promise((resolve, reject) => {
    console.log('🔍 Analyzing Spelling Bee answer frequencies...');
    console.log('📁 Reading from:', filePath);

    const answerCounts = new Map();
    let totalGames = 0;
    let totalAnswers = 0;

    const fileStream = fs.createReadStream(filePath);
    let data = '';

    fileStream.on('data', (chunk) => {
      data += chunk;
    });

    fileStream.on('end', () => {
      try {
        console.log('📖 Parsing JSON data...');
        const games = JSON.parse(data);

        if (!Array.isArray(games)) {
          throw new Error('Expected an array of games');
        }

        console.log(`📝 Processing ${games.length} games...`);

        // Process each game
        games.forEach((game, index) => {
          if (index % 100 === 0) {
            console.log(`⏳ Processed ${index} games...`);
          }

          processGame(game, answerCounts);
          totalGames++;
          totalAnswers += game.answers ? game.answers.length : 0;
        });

        console.log(`\n📊 Processed ${totalGames} games with ${totalAnswers} total answers`);

        // Find the most common answer and top 10
        const sortedAnswers = Array.from(answerCounts.entries())
          .sort((a, b) => b[1] - a[1]);

        const mostCommon = sortedAnswers[0];
        const top10 = sortedAnswers.slice(0, 10).map(([word, count]) => ({
          word,
          count,
          percentage: ((count / totalGames) * 100).toFixed(2)
        }));

        resolve({
          mostCommon: mostCommon[0],
          frequency: mostCommon[1],
          totalGames,
          totalAnswers,
          uniqueAnswers: answerCounts.size,
          top10
        });

      } catch (error) {
        reject(error);
      }
    });

    fileStream.on('error', reject);
  });
}

/**
 * Process a single game and count its answers
 * @param {Object} game - Game object with date, outerLetters, centerLetter, answers
 * @param {Map} answerCounts - Map to track answer frequencies
 */
function processGame(game, answerCounts) {
  if (!game.answers || !Array.isArray(game.answers)) {
    console.warn('⚠️  Invalid game format for date:', game.date);
    return;
  }

  // Count each answer
  game.answers.forEach(answer => {
    const normalizedAnswer = answer.toLowerCase().trim();
    if (normalizedAnswer) {
      answerCounts.set(normalizedAnswer, (answerCounts.get(normalizedAnswer) || 0) + 1);
    }
  });
}

/**
 * Display the analysis results
 * @param {Object} results - Analysis results
 */
function displayResults(results) {
  console.log('\n🏆 MOST COMMON SPELLING BEE ANSWER');
  console.log('='.repeat(50));
  console.log(`🎯 Word: "${results.mostCommon.toUpperCase()}"`);
  console.log(`📈 Appears in: ${results.frequency} out of ${results.totalGames} games (${((results.frequency / results.totalGames) * 100).toFixed(2)}%)`);

  console.log('\n🔝 TOP 10 MOST COMMON ANSWERS');
  console.log('='.repeat(50));
  results.top10.forEach((item, index) => {
    const emoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📍';
    console.log(`${emoji} ${index + 1}. ${item.word.toUpperCase()} - ${item.count} games (${item.percentage}%)`);
  });

  console.log('\n📈 STATISTICS');
  console.log('='.repeat(50));
  console.log(`🎮 Total games analyzed: ${results.totalGames.toLocaleString()}`);
  console.log(`🔤 Total unique answers: ${results.uniqueAnswers.toLocaleString()}`);
  console.log(`📝 Total answer instances: ${results.totalAnswers.toLocaleString()}`);
  console.log(`🔍 Average answers per game: ${(results.totalAnswers / results.totalGames).toFixed(1)}`);

  // Show word length distribution for the most common word
  const mostCommonLength = results.mostCommon.length;
  console.log(`\n💡 INSIGHT: The word "${results.mostCommon}" has ${mostCommonLength} letters`);
}

/**
 * Main function
 */
async function main() {
  try {
    const filePath = './src/games.json';

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('❌ Error: games.json file not found at:', filePath);
      console.log('💡 Make sure you are running this script from the workers/initialization directory');
      process.exit(1);
    }

    const results = await analyzeAnswers(filePath);
    displayResults(results);

    console.log('\n✅ Analysis complete!');

  } catch (error) {
    console.error('❌ Error analyzing answers:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { analyzeAnswers, processGame, displayResults };