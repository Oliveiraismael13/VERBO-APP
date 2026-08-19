import VerboApp from "../components/VerboApp";
import { chatGPTSignOutPath, requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

const ALLOWED_EMAIL = "marcioismael12@gmail.com";

export default async function Home() {
  if (process.env.NODE_ENV === "development") return <VerboApp />;

  const user = await requireChatGPTUser("/");
  if (user.email.toLowerCase() !== ALLOWED_EMAIL) {
    return (
      <main className="access-gate">
        <div className="access-mark">✦</div>
        <p>ACESSO PRIVADO</p>
        <h1>Esta conta não tem acesso ao Verbo</h1>
        <span>Você entrou como <b>{user.email}</b>. Por enquanto, o aplicativo está disponível somente para a conta autorizada.</span>
        <a href={chatGPTSignOutPath("/")}>Entrar com outra conta</a>
      </main>
    );
  }

  return <VerboApp />;
}
