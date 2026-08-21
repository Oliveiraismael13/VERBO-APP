"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isRunningAsApp() {
  return window.matchMedia("(display-mode: standalone)").matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export default function AppInstall() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const syncInstallState = () => {
      setInstalled(isRunningAsApp());
      setIos(/iPad|iPhone|iPod/.test(window.navigator.userAgent));
      setDismissed(localStorage.getItem("verbo-install-dismissed") === "1");
    };

    const receiveInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const markInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", receiveInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const stateFrame = window.requestAnimationFrame(syncInstallState);

    return () => {
      window.cancelAnimationFrame(stateFrame);
      window.removeEventListener("beforeinstallprompt", receiveInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
    };
  }, []);

  const close = () => {
    localStorage.setItem("verbo-install-dismissed", "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setInstalled(true);
  };

  if (installed || dismissed) return null;

  return (
    <aside className="install-app" aria-label="Instalar aplicativo Verbo">
      <span className="install-app-mark" aria-hidden="true">V</span>
      <div>
        <b>Tenha o Verbo no celular</b>
        <p>{ios ? "Toque em Compartilhar e depois em Adicionar à Tela de Início." : installPrompt ? "Instale para abrir diretamente como aplicativo." : "No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial."}</p>
      </div>
      {installPrompt && <button type="button" className="install-app-action" onClick={install}>Instalar</button>}
      <button type="button" className="install-app-close" aria-label="Fechar aviso de instalação" onClick={close}>×</button>
    </aside>
  );
}
