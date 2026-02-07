import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { dataRouter } from "./routes/data";
import { calendarRouter } from "./routes/calendar";
import { royalCaribbeanSyncRouter } from "./routes/royal-caribbean-sync";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
  calendar: calendarRouter,
  royalCaribbeanSync: royalCaribbeanSyncRouter,
});

export type AppRouter = typeof appRouter;
