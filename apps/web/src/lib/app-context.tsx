import { createContext, useContext } from "react";
import type { Session } from "./session";

export const SessionContext = createContext<Session | null>(null);
export function useServices() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Missing Atlas session provider");
  return session;
}
