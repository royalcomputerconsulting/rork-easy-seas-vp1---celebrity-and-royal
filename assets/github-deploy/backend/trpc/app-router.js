import { createTRPCRouter } from "./create-context.js";
import { exampleRouter } from "./routes/example.js";
import { dataRouter } from "./routes/data.js";
import { calendarRouter } from "./routes/calendar.js";
import { royalCaribbeanSyncRouter } from "./routes/royal-caribbean-sync.js";
import { cruiseDealsRouter } from "./routes/cruise-deals.js";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
  calendar: calendarRouter,
  royalCaribbeanSync: royalCaribbeanSyncRouter,
  cruiseDeals: cruiseDealsRouter,
});
