// bench.ts
   import { heavyFn } from "./src/the";
   console.time("heavy");
   for (let i = 0; i < 10_000; i++) heavyFn();
   console.timeEnd("heavy");