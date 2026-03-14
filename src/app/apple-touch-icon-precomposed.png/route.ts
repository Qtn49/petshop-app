// Prevents 404 when browsers request apple-touch-icon-precomposed (iOS)
export async function GET() {
  return new Response(null, { status: 204 });
}
