import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { dataRouter } from "./routes/data";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
});

export type AppRouter = typeof appRouter;
