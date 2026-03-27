/**
 * gaWorker.ts
 * Web Worker – GA 최적화를 백그라운드에서 실행
 * UI 스레드를 블로킹하지 않음
 */
import { runGa } from '../utils/gaEngine';
import type { GaConfig, GaWorkerMessage } from '../utils/gaEngine';

interface WorkerInput {
  matrix:   number[][];
  subjects: string[];
  daySizes: number[];
  config:   GaConfig;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { matrix, subjects, daySizes, config } = e.data;

  const result = runGa(matrix, subjects, daySizes, config, (gen, total, score) => {
    const msg: GaWorkerMessage = { type: 'progress', gen, total, score };
    self.postMessage(msg);
  });

  const msg: GaWorkerMessage = { type: 'complete', result };
  self.postMessage(msg);
};
