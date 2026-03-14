// Prevents 404 when browsers request apple-touch-icon (iOS home screen)
export async function GET() {
  return new Response(null, { status: 204 });
}
