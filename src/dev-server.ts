import {
  WebSocketClient,
  WebSocketServer,
} from 'https://deno.land/x/websocket@v0.1.2/mod.ts';
import { Application, send } from 'https://deno.land/x/oak@v7.7.0/mod.ts';
import { EventEmitter } from 'https://deno.land/std@0.100.0/node/events.ts';
import * as path from 'https://deno.land/std@0.99.0/path/mod.ts';
import { debounce } from './utils.ts';
import { generate } from './generate.ts';

const emitter = new EventEmitter();

const startReloadServer = () => {
  const wss = new WebSocketServer(8080);
  wss.on('connection', (ws: WebSocketClient) => {
    console.log('client connected');

    const reloadListener = () => ws.send('reload');

    emitter.addListener('fileChange', reloadListener);

    ws.on('close', () => {
      emitter.removeListener('fileChange', reloadListener);
      console.log('client disconnected');
    });
  });
  console.log('reload enabled');
};

const startServer = async () => {
  const app = new Application();

  app.use(async (context: any) => {
    await send(context, context.request.url.pathname, {
      root: path.join(Deno.cwd(), 'dist'),
      index: 'index.html',
    });
  });

  console.log('server started');
  await app.listen({ port: 5000 });
};

const watchBuild = async () => {
  const watcher = Deno.watchFs(path.join(Deno.cwd(), 'dist'));

  const onFileChange = debounce(() => {
    console.log('reloading...');
    emitter.emit('fileChange');
  });

  for await (const event of watcher) {
    if (/modify|create/.test(event.kind)) {
      onFileChange();
    }
  }
};

const watchSource = async () => {
  const watcher = Deno.watchFs(
    ['assets', 'components', 'pages'].map((name) => path.join(Deno.cwd(), name))
  );

  const onFileChange = debounce(() => {
    generate();
  });

  for await (const event of watcher) {
    if (/modify|create/.test(event.kind)) {
      onFileChange();
    }
  }
};

export const startDev = async () => {
  await generate();
  startReloadServer();
  startServer();
  watchSource();
  watchBuild();
};

if (import.meta.main) {
  startDev();
}
