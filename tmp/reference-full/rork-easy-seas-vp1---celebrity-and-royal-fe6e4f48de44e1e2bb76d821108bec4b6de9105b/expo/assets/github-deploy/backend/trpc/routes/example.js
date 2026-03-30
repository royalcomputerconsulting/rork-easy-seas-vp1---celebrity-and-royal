import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context.js";

export const exampleRouter = createTRPCRouter({
  hi: publicProcedure
    .input(z.object({ name: z.string() }))
    .mutation(({ input }) => {
      return {
        hello: input.name,
        date: new Date(),
      };
    }),
});
