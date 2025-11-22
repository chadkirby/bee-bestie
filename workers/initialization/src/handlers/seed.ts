interface SeedOptions {
  dryRun?: boolean;
}

export async function handleSeed(
  env: Env,
  options: SeedOptions = {}
): Promise<{
  success: boolean;
  message: string;
  result?: {
    totalPuzzles: number;
    totalWordMappings: number;
    batchesProcessed?: number;
  };
}> {
  try {
    const { dryRun = false } = options;

    // Load the games data
    const gamesData = await import('../games.json', {
      with: { type: 'json' },
    }).then((res) => res.default);

    // Prepare word-date pairs for efficient batch processing
    const wordDatePairs: Array<{ word: string; date: string }> = [];
    gamesData.forEach((game) => {
      game.answers.forEach((word) => {
        wordDatePairs.push({ word: word.toLowerCase(), date: game.date });
      });
    });

    const totalPuzzles = gamesData.length;
    const totalWordMappings = wordDatePairs.length;

    if (dryRun) {
      return {
        success: true,
        message: `Dry run completed. Would process ${totalPuzzles} puzzles with ${totalWordMappings} word mappings.`,
        result: {
          totalPuzzles,
          totalWordMappings,
        },
      };
    }

    // Execute puzzle inserts in batches using D1 batch API
    let batchesProcessed = 0;
    const gameBatchSize = 500;
    for (let i = 0; i < gamesData.length; i += gameBatchSize) {
      const batch = gamesData.slice(i, i + gameBatchSize);

      const batchStatements = batch.map((game) =>
        env.BEE_PUZZLES.prepare(
          `INSERT OR REPLACE INTO puzzles (date, centerLetter, outerLetters) VALUES (?, ?, ?)`
        ).bind(game.date, game.centerLetter, JSON.stringify(game.outerLetters))
      );

      await env.BEE_PUZZLES.batch(batchStatements);
      batchesProcessed++;
      console.log(
        `Inserted ${batchesProcessed} of ${Math.ceil(gamesData.length / gameBatchSize)} batches of puzzles.`
      );
    }

    batchesProcessed = 0;
    const wordBatchSize = 5000;
    // Execute word-date inserts in batches using D1 batch API
    for (let i = 0; i < wordDatePairs.length; i += wordBatchSize) {
      const batch = wordDatePairs.slice(i, i + wordBatchSize);

      const batchStatements = batch.map((pair) =>
        env.BEE_PUZZLES.prepare(
          `INSERT OR IGNORE INTO word_dates (word, date) VALUES (?, ?)`
        ).bind(pair.word, pair.date)
      );

      await env.BEE_PUZZLES.batch(batchStatements);
      batchesProcessed++;
      console.log(
        `Inserted ${batchesProcessed} of ${Math.ceil(wordDatePairs.length / wordBatchSize)} batches of word-date mappings.`
      );
    }

    return {
      success: true,
      message: `Database seeded successfully. Processed ${totalPuzzles} puzzles and ${totalWordMappings} word mappings in ${batchesProcessed} batches.`,
      result: {
        totalPuzzles,
        totalWordMappings,
        batchesProcessed,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: `Seeding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
