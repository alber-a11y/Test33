import { getLevel } from './levels';

self.onmessage = (e: MessageEvent<number>) => {
  const info = getLevel(e.data);
  (self as unknown as Worker).postMessage(info);
};
