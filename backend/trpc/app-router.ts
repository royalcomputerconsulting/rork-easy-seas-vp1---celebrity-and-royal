import { createTRPCRouter } from "./create-context";
import { exampleRouter } from "./routes/example";
import { dataRouter } from "./routes/data";
import { calendarRouter } from "./routes/calendar";
import { royalCaribbeanSyncRouter } from "./routes/royal-caribbean-sync";
import { cruiseDealsRouter } from "./routes/cruise-deals";
import { crewRecognitionRouter } from "./routes/crew-recognition";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  data: dataRouter,
  calendar: calendarRouter,
  royalCaribbeanSync: royalCaribbeanSyncRouter,
  cruiseDeals: cruiseDealsRouter,
  crewRecognition: crewRecognitionRouter,
});

export type AppRouter = typeof appRouter;
