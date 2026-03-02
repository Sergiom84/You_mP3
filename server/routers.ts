import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  converter: router({
    validateUrl: publicProcedure
      .input((data: unknown) => {
        if (typeof data !== "object" || data === null) throw new Error("Invalid input");
        const obj = data as Record<string, unknown>;
        if (typeof obj.url !== "string") throw new Error("URL is required");
        return { url: obj.url };
      })
      .mutation(async ({ input }) => {
        const { isValidYouTubeUrl } = await import("./utils/youtube");
        if (!isValidYouTubeUrl(input.url)) {
          return { valid: false, error: "URL de YouTube inválida" };
        }
        try {
          const { getVideoInfo } = await import("./utils/converter");
          const info = await getVideoInfo(input.url);
          return { valid: true, info };
        } catch (error) {
          return { valid: false, error: (error as Error).message };
        }
      }),

    convert: protectedProcedure
      .input((data: unknown) => {
        if (typeof data !== "object" || data === null) throw new Error("Invalid input");
        const obj = data as Record<string, unknown>;
        if (typeof obj.url !== "string") throw new Error("URL is required");
        return { url: obj.url };
      })
      .mutation(async ({ input }) => {
        const { isValidYouTubeUrl, normalizeYouTubeUrl } = await import("./utils/youtube");

        if (!isValidYouTubeUrl(input.url)) {
          throw new Error("URL de YouTube inválida");
        }

        const normalizedUrl = normalizeYouTubeUrl(input.url);

        return {
          success: true,
          downloadUrl: `/api/download-mp3?url=${encodeURIComponent(normalizedUrl)}`,
        };
      }),

    history: protectedProcedure.query(async ({ ctx }) => {
      const { getUserConversions } = await import("./db");
      try {
        const conversions = await getUserConversions(ctx.user.id, 50);
        return conversions;
      } catch (error) {
        console.error("[API] History error:", error);
        return [];
      }
    }),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
