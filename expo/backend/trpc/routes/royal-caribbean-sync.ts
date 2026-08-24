import { createTRPCRouter, publicProcedure } from "../create-context";

/**
 * The server deliberately has no procedure that accepts cruise-line cookies,
 * credentials, or a browser session. Provider authentication stays in the
 * user's WebView or browser extension, where the session is not exfiltrated.
 */
export const royalCaribbeanSyncRouter = createTRPCRouter({
  checkStatus: publicProcedure.query(() => ({
    available: true,
    transport: "device_webview_or_extension" as const,
    message: "Sign in directly with the cruise line in Easy Seas or use the browser extension. Easy Seas never accepts provider credentials or cookies on its backend.",
  })),
});
