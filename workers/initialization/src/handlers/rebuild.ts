import { handleMigration } from './migrate.js';
import { handleSeed } from './seed.js';

interface RebuildOptions {
  dryRun?: boolean;
}

export async function handleRebuild(
  env: Env,
  options: RebuildOptions = {}
): Promise<{
  success: boolean;
  message: string;
  steps?: Array<{ step: string; success: boolean; message: string }>;
}> {
  const { dryRun = false } = options;
  const steps: Array<{ step: string; success: boolean; message: string }> = [];

  if (!dryRun) {
    return {
      success: false,
      message:
        'Rebuild requires confirmation. Set confirmDestructive=true to proceed or use dryRun=true for a test run.',
    };
  }

  try {
    // Step 1: Migration (creates/recreates schema)
    const migrationResult = await handleMigration(env);
    steps.push({
      step: 'Migration',
      success: migrationResult.success,
      message: migrationResult.message,
    });

    if (!migrationResult.success && !dryRun) {
      return {
        success: false,
        message: `Rebuild failed at migration step: ${migrationResult.message}`,
        steps,
      };
    }

    // Step 2: Seeding (populates data)
    const seedResult = await handleSeed(env, { dryRun });
    steps.push({
      step: 'Seeding',
      success: seedResult.success,
      message: seedResult.message,
    });

    if (!seedResult.success && !dryRun) {
      return {
        success: false,
        message: `Rebuild failed at seeding step: ${seedResult.message}`,
        steps,
      };
    }

    const allStepsSuccessful = steps.every((step) => step.success);

    return {
      success: allStepsSuccessful,
      message: dryRun
        ? 'Dry run completed successfully. Use confirmDestructive=true to perform actual rebuild.'
        : 'Database rebuild completed successfully.',
      steps,
    };
  } catch (error) {
    return {
      success: false,
      message: `Rebuild failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      steps,
    };
  }
}
