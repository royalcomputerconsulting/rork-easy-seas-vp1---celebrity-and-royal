import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { dataRouter } from "./routes/data";
import { calendarRouter } from "./routes/calendar";
import { royalCaribbeanSyncRouter } from "./routes/royal-caribbean-sync";
import { priceTrackingRouter } from "./routes/price-tracking";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
  calendar: calendarRouter,
  royalCaribbeanSync: royalCaribbeanSyncRouter,
  priceTracking: priceTrackingRouter,
});

export type AppRouter = typeof appRouter;
