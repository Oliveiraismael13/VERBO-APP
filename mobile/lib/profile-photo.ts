export async function resizeProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem para o perfil.");
  if (file.size > 12_000_000) throw new Error("Escolha uma imagem de até 12 MB.");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const preview = new Image();
    preview.onerror = () => reject(new Error("Não foi possível abrir a imagem."));
    preview.onload = () => resolve(preview);
    preview.src = source;
  });
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const offsetX = (image.naturalWidth - side) / 2;
  const offsetY = (image.naturalHeight - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(image, offsetX, offsetY, side, side, 0, 0, 256, 256);
  return canvas.toDataURL("image/jpeg", 0.84);
}
