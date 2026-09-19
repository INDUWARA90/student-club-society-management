/** Reads any file as a base64 data URL, unmodified (unlike fileToBase64.js, which is image-only/resizes). */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
