import { NYTPuzzleDataSchema, DBPuzzleSchema, type DBPuzzle, getDbManager } from '@lib/puzzle';
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
			// Initialize DB manager
			const dbManager = getDbManager(env.BEE_PUZZLES);

			// Fetch today's puzzle data from NYT
			const gameData = await getToday();
			const puzzles = [gameData.today, ...gameData.pastPuzzles.thisWeek, ...gameData.pastPuzzles.lastWeek];

			for (const puzzle of puzzles) {
				console.log(`Processing puzzle for ${puzzle.printDate}`);

				// Prepare data for database insertion
				const dbPuzzleData: DBPuzzle = {
					date: puzzle.printDate,
					centerLetter: puzzle.centerLetter,
					outerLetters: JSON.stringify(puzzle.outerLetters),
				};

				// Validate data with DBPuzzleSchema
				const validatedPuzzle = DBPuzzleSchema.parse(dbPuzzleData);

				// Check if puzzle already exists
				const puzzleExists = await dbManager.puzzleExists(validatedPuzzle.date);
				if (puzzleExists) {
					console.log(`Puzzle for ${validatedPuzzle.date} already exists, skipping`);
					// continue;
				}

				// Use DB manager to insert puzzle and word-date relationships
				const result = await dbManager.upsertPuzzleWithWords(validatedPuzzle, puzzle.answers);

				console.log(`Puzzle insertion for ${validatedPuzzle.date}:`, {
					puzzleInserted: result.puzzleInserted,
					wordDatesInserted: result.wordDatesInserted,
				});

				console.log(`Successfully processed daily puzzle for ${validatedPuzzle.date}`);

				// stream data from R2:bee-data/word_stats.csv to solve any missing words
				const r2Object = await env.BEE_BUCKET.get('word_stats.csv');
				if (!r2Object) {
					console.error('word_stats.csv not found in R2 bucket');
					continue;
				}

				const readableStream = r2Object.body;
				if (!readableStream) {
					console.error('word_stats.csv has no body stream');
					continue;
				}

				const answerPattern = new RegExp(`^"[${puzzle.outerLetters.join('')}${puzzle.centerLetter}]{4,}"$`, 'i');
				const otherAnswers: string[] = [];
				// we can't fit all word freqs in memory, so stream and check each word
				const reader = readableStream.getReader();
				const decoder = new TextDecoder('utf-8');
				let { value: chunk, done: readerDone } = await reader.read();
				let buffer = '';
				while (!readerDone) {
					buffer += decoder.decode(chunk, { stream: true });
					if (/\n/.test(buffer)) {
						let lines = buffer.split('\n');
						buffer = lines.pop() || '';
						for (const line of lines) {
							const [word] = line.split(',');
							if (answerPattern.test(word) && !puzzle.answers.includes(word)) {
								otherAnswers.push(word);
							}
						}
					}
					({ value: chunk, done: readerDone } = await reader.read());
				}
				// Process any remaining buffer
				if (buffer) {
					const lines = buffer.split('\n');
					for (const line of lines) {
						const [word] = line.split(',');
						if (answerPattern.test(word) && !puzzle.answers.includes(word)) {
							otherAnswers.push(word);
						}
					}
				}
			}
		} catch (error) {
			console.error('Error processing daily puzzle:', error);
			// Re-throw to ensure the error is logged in Cloudflare's system
			throw error;
		}
	},
} satisfies ExportedHandler<Env>;
