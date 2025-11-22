import migrationSQL from './migration.sql.js';

export async function handleMigration(
  env: Env
): Promise<{ success: boolean; message: string }> {
  try {
    // Read migration.sql file using Node.js fs module available in Cloudflare Workers

    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);

    for (const statement of statements) {
      await env.BEE_PUZZLES.prepare(statement).run();
    }

    return {
      success: true,
      message: `Database migration completed successfully. Executed ${statements.length} statements.`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
