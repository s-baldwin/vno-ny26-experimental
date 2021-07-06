import Vue from 'https://deno.land/x/vue_js@0.0.5/mod.js';
import * as fs from 'https://deno.land/std@0.83.0/fs/mod.ts';
import * as vueCompiler from 'https://denopkg.com/crewdevio/vue-deno-compiler/mod.ts';
import renderer from 'https://deno.land/x/vue_server_renderer@0.0.4/mod.js';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import { getExport, getTags, Mapped, VueExport } from './utils.ts';

export interface Component {
  name: string;
  path: string;
  raw: string;
  source: any;
  deps: Set<string>;
  exports: VueExport['default'];
  css: string[];
  vueCmp: any;
}

/**
 * Detect if there are any circular dependencies within components.
 */
const checkDepsCycle = (cmps: Mapped<Component>) => {
  // keep track of seen and completed components
  const seen = new Set<string>();
  const completed = new Set<string>();

  // perform dfs
  const dfs = (cmp: Component) => {
    // loop through dependencies
    for (const depName of cmp.deps) {
      // if a component is seen but not completed, then that means the component has remaining dependencies that have not been completed
      if (seen.has(depName) && !completed.has(depName)) {
        return true;
      }

      // perform dfs on dependency
      if (!seen.has(depName)) {
        seen.add(depName);
        if (dfs(cmps[depName])) return true;
      }
    }

    // have completed all depencies so component is complete
    completed.add(cmp.name);
    return false;
  };

  // check all components
  for (const cmp of Object.values(cmps)) {
    if (!seen.has(cmp.name)) {
      seen.add(cmp.name);
      if (dfs(cmp)) return true;
    }
  }
  return false;
};

/**
 * Add dependency info to a component.
 */
export const addComponentDeps = (cmp: Component, cmps: Mapped<Component>) => {
  const deps = new Set<string>();

  const tags = getTags(cmp.source.descriptor.template.content as string);

  for (const tag of tags) {
    if (tag in cmps) {
      deps.add(tag);
    }
  }

  return deps;
};

/**
 * Add depency info to all components.
 */
const addComponentsDeps = (cmps: Mapped<Component>) => {
  for (const cmp of Object.values(cmps)) {
    cmp.deps = addComponentDeps(cmp, cmps);
  }
};

/**
 * Add css info to all components, a component should have css for itself and all of its dependent components.
 */
const addCssDeps = (cmps: Mapped<Component>) => {
  const seen = new Set<string>();

  // perform dfs
  const dfs = (cmp: Component) => {
    const seenCss = new Set(cmp.css);

    // loop through dependencies
    for (const depName of cmp.deps) {
      // complete dependencies first
      if (!seen.has(depName)) {
        seen.add(depName);
        dfs(cmps[depName]);
      }

      // add unique css from dependency
      for (const css of cmps[depName].css) {
        if (!seenCss.has(css)) {
          seenCss.add(css);
          cmp.css.push(css);
        }
      }
    }
  };

  // do for all components
  for (const cmp of Object.values(cmps)) {
    if (!seen.has(cmp.name)) {
      seen.add(cmp.name);
      dfs(cmp);
    }
  }
};

/**
 * Add vue component to all components.
 */
const addVue = (cmps: Mapped<Component>) => {
  const seen = new Set<string>();

  // perform dfs
  const dfs = (cmp: Component) => {
    const components: { [name: string]: any } = {};

    // complete dependencies first
    for (const depName of cmp.deps) {
      if (!seen.has(depName)) {
        seen.add(depName);
        dfs(cmps[depName]);
      }

      // add vue component dependency, needed for vue
      components[depName] = cmps[depName].vueCmp;
    }

    // create the vue component
    const vueCmp = (Vue as any).component(cmp.name, {
      ...cmp.exports,
      name: cmp.name,
      template: cmp.source.descriptor.template.content as string,
      components,
    });

    // add the vue component
    cmp.vueCmp = vueCmp;
  };

  // do for all components
  for (const cmp of Object.values(cmps)) {
    seen.add(cmp.name);
    dfs(cmp);
  }
};

/**
 * Get the info for a vue component.
 */
export const getComponent = async (filePath: string): Promise<Component> => {
  const name = path.parse(filePath).name;

  // read file
  const raw = await Deno.readTextFile(filePath);

  // parse
  const source = vueCompiler.parse(raw);

  // get script export
  const obj = await getExport(source.descriptor.script.content as string);

  return {
    name,
    path: filePath,
    raw,
    source,
    deps: new Set(),
    exports: obj.default,
    css: obj.default.css || [],
    vueCmp: null,
  };
};

/**
 * Get all project vue components.
 */
export const getComponents = async () => {
  const cmps: Mapped<Component> = {};

  // get components from components folder
  for await (const file of fs.walk(path.join(Deno.cwd(), 'components'), {
    exts: ['vue'],
  })) {
    const cmp = await getComponent(file.path);
    cmps[cmp.name] = cmp;
  }

  // add component dependencies
  addComponentsDeps(cmps);

  // check if a cycle exists
  if (checkDepsCycle(cmps)) {
    throw Error('cycle exists');
  }

  // add css dependencies
  addCssDeps(cmps);

  // add vue components
  addVue(cmps);

  return cmps;
};

// DEVELOPMENT ONLY
const main = async () => {
  const cmps = await getComponents();

  const app = new Vue({
    name: 'app',
    template: '<div><h1>My App</h1><Navbar /></div>',
    components: {
      Navbar: cmps['Navbar'].vueCmp,
    },
  });

  return new Promise((resolve, reject) =>
    renderer(app, (err: any, html: string) => {
      if (err) {
        return reject(err);
      }
      return resolve(html);
    })
  );
};

if (import.meta.main) {
  console.log(await main());
}
