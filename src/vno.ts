import { startDev } from './dev-server.ts';

const res = prompt('start the server?:');

if (res?.startsWith('y')) {
  startDev();
}
