import fs from 'fs/promises';
import path from 'path';

/**
 * Deletes all contents inside the given directory (but not the directory itself).
 */
export async function clearDirectoryContents(directoryPath: string) {
    try {
        const files = await fs.readdir(directoryPath);
        for (const file of files) {
            const filePath = path.join(directoryPath, file);
            const stat = await fs.lstat(filePath);

            if (stat.isDirectory()) {
                // Recursively remove subdirectory
                await fs.rm(filePath, { recursive: true, force: true });
            } else {
                await fs.unlink(filePath);
            }
        }

        console.log(`[Init] Cleared contents of ${directoryPath}`);
    } catch (err) {
        console.error(`[Init] Failed to clear directory ${directoryPath}:`, err);
    }
}
