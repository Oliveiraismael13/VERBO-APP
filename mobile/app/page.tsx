import VerboApp from "../components/VerboApp";
import AuthPage from "./auth/page";
import { currentUser } from "../lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await currentUser();
  return user ? <VerboApp /> : <AuthPage />;
}
