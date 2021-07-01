import Vue from "https://deno.land/x/vue_js@0.0.5/mod.js";
import * as fs from "https://deno.land/std@0.99.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.99.0/path/mod.ts";
import * as vueCompiler from "https://denopkg.com/crewdevio/vue-deno-compiler/mod.ts";
import renderer from "https://deno.land/x/vue_server_renderer@0.0.4/mod.js";
import { Language, minify } from "https://deno.land/x/minifier@v1.1.1/mod.ts";
import { Component, getComponents, getTags } from "./components.ts";
import { getExport, Mapped } from "./utils.ts";

export const getComponent = async (filePath: string) => {
  const name = path.parse(filePath).name;

  // read file
  const raw = await Deno.readTextFile(filePath);

  // parse
  const source = vueCompiler.parse(raw);

  // get script export
  const obj = await getExport(source.descriptor.script.content as string);

  return {
    name,
    raw,
    source,
    exports: obj.default,
  };
};

export const toHtml = async (
  filePath: string,
  outfile: string,
  id?: string,
  cmps?: Mapped<Component>,
) => {
  // components
  if (!cmps) {
    cmps = await getComponents();
  }

  const name = path.parse(filePath).name;

  // read file
  const text = await Deno.readTextFile(filePath);

  // parse
  const source = vueCompiler.parse(text);

  // get script export
  const obj = await getExport(source.descriptor.script.content as string);

  // clean template
  const template = (source.descriptor.template.content as string).replace(
    /<!--([\s\S]*?)-->/gm,
    "",
  );

  // get dependencies
  const components: Mapped<Component> = {};
  const tags = getTags(template);
  for (const tag of tags) {
    if (tag in cmps && !(tag in components)) {
      components[tag] = cmps[tag];
    }
  }

  // get data
  const data = await Promise.resolve(
    obj.default.getStaticProps ? obj.default.getStaticProps(id) : {},
  );

  // page component
  const App = new Vue({
    name,
    template,
    data() {
      return data;
    },
    components,
  });

  // html
  const html = await new Promise<string>((resolve, reject) => {
    renderer(App, (err: any, html: string) => {
      if (err) {
        return reject(err);
      }
      return resolve(html);
    });
  });

  // write to file
  await fs.ensureDir(path.parse(outfile).dir);
  return Deno.writeTextFile(
    outfile,
    minify(Language.HTML, html),
  );
};

if (import.meta.main) {
  toHtml("./pages/index.vue", "./dist/index.vue");
}
