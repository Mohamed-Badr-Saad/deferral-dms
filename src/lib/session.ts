import { auth } from "./auth";

export async function getSession() {
  try {
    return await auth.api.getSession({ headers: new Headers() });
  } catch {
    return null;
  }
}
