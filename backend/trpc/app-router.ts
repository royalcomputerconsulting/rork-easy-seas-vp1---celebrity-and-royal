import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { dataRouter } from "./routes/data";
import { calendarRouter } from "./routes/calendar";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
  calendar: calendarRouter,
});

export type AppRouter = typeof appRouter;
