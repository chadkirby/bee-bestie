import { NYTPuzzleDataSchema, DBPuzzleSchema, type DBPuzzle } from '@lib/puzzle';
import { DateTime } from 'luxon';

async function getToday() {
	const res = await fetch('https://www.nytimes.com/puzzles/spelling-bee');
	const html = await res.text();
	const gameDataScript = /(?<=<script\b.+?window\.gameData\s*=\s*)\{.+?\}(?=\s*<\/script>)/.exec(html);
	if (gameDataScript) {
		const gameData = NYTPuzzleDataSchema.parse(JSON.parse(gameDataScript[0]));
		return gameData;
	}

	throw new Error('Could not find game data on NYT Spelling Bee page');
}

/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your Worker in action
 * - Run `npm run deploy` to publish your Worker
 *
 * Bind resources to your Worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(req) {
		const url = new URL(req.url);
		url.pathname = '/__scheduled';
		url.searchParams.append('cron', '1-5 17 * * *');
		return new Response(`To test the scheduled handler, ensure you have used the "--test-scheduled" then try running "curl ${url.href}".`);
	},

	// The scheduled handler is invoked at the interval set in our wrangler.jsonc's
	// [[triggers]] configuration.
	async scheduled(event, env, ctx): Promise<void> {
		console.log(`Daily puzzle cron triggered at ${event.cron}`);
		const easternNow = DateTime.now().setZone('America/New_York').toISO();
		const pacificNow = DateTime.now().setZone('America/Los_Angeles').toISO();
		console.log(`Current time in EST: ${easternNow}, PST: ${pacificNow}`);

		try {
			// Fetch today's puzzle data from NYT
			const gameData = await getToday();
			const puzzles = [gameData.today, ...gameData.pastPuzzles.thisWeek, ...gameData.pastPuzzles.lastWeek];
			for (const puzzle of puzzles) {
				console.log(`Fetched puzzle for ${puzzle.printDate}`);

				// Prepare data for database insertion
				const dbPuzzleData: DBPuzzle = {
					date: puzzle.printDate,
					centerLetter: puzzle.centerLetter,
					outerLetters: JSON.stringify(puzzle.outerLetters),
				};

				// Validate data with DBPuzzleSchema
				const validatedPuzzle = DBPuzzleSchema.parse(dbPuzzleData);

				// Insert/update puzzle in database
				const insertPuzzleStmt = env.bee_puzzles
					.prepare(
						`
					INSERT OR IGNORE INTO puzzles (date, centerLetter, outerLetters)
					VALUES (?, ?, ?)
				`,
					)
					.bind(validatedPuzzle.date, validatedPuzzle.centerLetter, validatedPuzzle.outerLetters);

				const puzzleResult = await insertPuzzleStmt.run();
				console.log(`Inserted puzzle for ${validatedPuzzle.date}, changes: ${puzzleResult.meta?.changes}`);

				// Insert word-date relationships
				const wordDateInserts = puzzle.answers.map((word) =>
					env.bee_puzzles
						.prepare(
							`
					INSERT OR IGNORE INTO word_dates (word, date)
					VALUES (?, ?)
				`,
						)
						.bind(word.toLowerCase(), validatedPuzzle.date),
				);

				if (wordDateInserts.length > 0) {
					const wordDateResults = await env.bee_puzzles.batch(wordDateInserts);
					const totalChanges = wordDateResults.reduce((sum, result) => sum + (result.meta?.changes || 0), 0);
					console.log(`Inserted ${totalChanges} word-date relationships`);
				}

				console.log(`Successfully processed daily puzzle for ${validatedPuzzle.date}`);
			}
		} catch (error) {
			console.error('Error processing daily puzzle:', error);
			// Re-throw to ensure the error is logged in Cloudflare's system
			throw error;
		}
	},
} satisfies ExportedHandler<Env>;
