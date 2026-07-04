import { redirect } from "next/navigation";

/**
 * Root entry point → the live console. If the user isn't authenticated, the
 * console's API calls return 401 and the client redirects to /login.
 */
export default function Home() {
  redirect("/console");
}
