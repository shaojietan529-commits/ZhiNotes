export async function dataUrlToArrayBuffer(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.arrayBuffer();
}
