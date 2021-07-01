import * as fs from "https://deno.land/std@0.99.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.99.0/path/mod.ts";
import { getComponent, toHtml } from "./data.ts";

const genPages = async () => {
  for await (const file of fs.walk("./pages", { exts: ["vue"] })) {
    const parsed = path.parse(file.path);
    const relPath = parsed.dir.replace(/^.?pages\/?/, "");
    const name = parsed.name;

    if (name.match(/\[.*\]/)) {
      const cmp = await getComponent(file.path);

      if (!cmp.exports.getStaticPaths) {
        throw Error("missing getStaticPaths");
      }

      const ids = await Promise.resolve(cmp.exports.getStaticPaths());
      for (const id of ids) {
        const outPath = path.join("./dist", relPath, id + ".html");
        await toHtml(file.path, outPath, id);
      }
    } else {
      const outPath = path.join("./dist", relPath, name + ".html");
      await toHtml(file.path, outPath);
    }
  }
};

if (import.meta.main) {
  genPages();
}
