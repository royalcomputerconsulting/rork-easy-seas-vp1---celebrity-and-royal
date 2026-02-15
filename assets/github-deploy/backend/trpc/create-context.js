import { initTRPC } from "@trpc/server";
import superjson from "superjson";

export const createContext = async (opts) => {
  return {
    req: opts.req,
  };
};

const t = initTRPC.context().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
