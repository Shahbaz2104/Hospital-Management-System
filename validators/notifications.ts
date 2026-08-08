import { z } from "zod";

export const markNotificationReadSchema = z.object({
  read: z.boolean().default(true),
});
