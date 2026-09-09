import fs from 'node:fs';
import path from 'node:path';
// Preserve build failures. Let successful Windows builds drain native workers
// instead of calling process.exit() while their handles are closing.
const nativeExit = process.exit;
let finalized = false;
process.exit = function (code) {
  if (code !== undefined && Number(code) !== 0) return nativeExit(code);
  if (!finalized) {
    finalized = true;
    const root = path.resolve('dist/client');
    const prefix = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
    if (prefix) {
      if (
        !/^\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/.test(prefix) ||
        prefix.split('/').includes('..')
      )
        throw new Error('Invalid Pages path');
      const nested = path.resolve(root, '.' + prefix, '_next');
      const target = path.resolve(root, '_next');
      // Both move targets must remain inside this project's generated output.
      for (const targetPath of [nested, target]) {
        const relative = path.relative(root, targetPath);
        if (relative.startsWith('..') || path.isAbsolute(relative))
          throw new Error('Unsafe build output path');
      }
      // Pages already mounts the artifact at /repository; only its asset URL
      // needs the prefix, not the artifact's internal directory structure.
      if (fs.existsSync(nested)) fs.renameSync(nested, target);
    }
    if (!fs.existsSync(path.join(root, 'index.html')))
      throw new Error('Static home page was not generated');
    // Remove localhost-only tags injected into prerender responses by desktop
    // software. The app must not ship a dependency on the author's machine.
    for (const name of ['index.html', '404.html']) {
      const file = path.join(root, name);
      if (fs.existsSync(file)) {
        const html = fs.readFileSync(file, 'utf8');
        fs.writeFileSync(
          file,
          html.replace(
            /<script\b[^>]*\bsrc=["'](?:https?:)?\/\/local\.adguard\.org[^"']*["'][^>]*>[\s\S]*?<\/script>/gi,
            '',
          ),
        );
      }
    }
    fs.writeFileSync(path.join(root, '.nojekyll'), '');
  }
  process.exitCode = 0;
  return undefined;
};
process.argv = [process.execPath, 'vinext', 'build', ...process.argv.slice(2)];
await import('../node_modules/vinext/dist/cli.js');
