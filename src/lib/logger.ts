import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss",
          },
        }
      : undefined,
  base: undefined,
});

export function childLogger(bindings: Record<string, string>) {
  return logger.child(bindings);
}
