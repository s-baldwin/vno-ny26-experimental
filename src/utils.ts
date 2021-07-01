import * as path from "https://deno.land/std@0.99.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.83.0/fs/mod.ts";
import { Language, minify } from "https://deno.land/x/minifier@v1.1.1/mod.ts";

export type Mapped<T> = { [key: string]: T };

interface VueExport {
  default: {
    name: string;
    getStaticProps?: (id?: string) => any;
    getStaticPaths?: () => any;
  };
}

// get script export
export const getExport = async (script: string) => {
  const cachePath = path.join(Deno.cwd(), ".cache");
  await fs.ensureDir(cachePath);

  const jsPath = path.join(
    cachePath,
    `${Math.random().toString(36).substring(7)}.js`,
  );

  let obj: VueExport | null = null;
  let created = false;

  try {
    await Deno.writeTextFile(jsPath, minify(Language.JS, script));
    created = true;
    obj = await import(jsPath) as VueExport;
  } finally {
    if (created) await Deno.remove(jsPath);
  }

  if (!obj) throw Error("could not import script");
  return obj;
};
