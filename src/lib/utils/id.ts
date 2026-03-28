import { nanoid } from "nanoid";

export function generateId(): string {
  return nanoid();
}

// Default owner ID for solo user mode
export const DEFAULT_OWNER_ID = "solo-user";
