import * as fs from 'https://deno.land/std@0.99.0/fs/mod.ts';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import { getComponent, toHtml } from './data.ts';
import { getComponents } from './components.ts';

const genPages = async () => {
  const cmps = await getComponents();

  for await (const file of fs.walk(path.join(Deno.cwd(), './pages'), {
    exts: ['vue'],
  })) {
    const parsed = path.parse(file.path);
    const relPath = parsed.dir.replace(/^.?pages\/?/, '');
    const name = parsed.name;

    // dynamic
    if (name.match(/\[.*\]/)) {
      const cmp = await getComponent(file.path);

      if (!cmp.exports.getStaticPaths) {
        throw Error('missing getStaticPaths');
      }

      const allPathData = await Promise.resolve(cmp.exports.getStaticPaths());
      for (const pathData of allPathData) {
        const id = pathData.params[name.slice(1, name.length - 1)];
        const outPath = path.join('./dist', relPath, id + '.html');
        await toHtml({
          filePath: file.path,
          outFile: outPath,
          pathData,
          cmps,
        });
      }
    } else {
      const outPath = path.join('./dist', relPath, name + '.html');
      await toHtml({
        filePath: file.path,
        outFile: outPath,
        cmps,
      });
    }
  }
};

if (import.meta.main) {
  genPages();
}
