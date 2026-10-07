export async function onRequest(context) {
  const url = new URL(context.request.url);

  // If visited via *.pages.dev, redirect permanently (301) to board.seosiri.com
  if (url.hostname.includes("pages.dev")) {
    url.hostname = "board.seosiri.com";
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
