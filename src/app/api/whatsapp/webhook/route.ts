// Removed feature.
export async function GET() {
  return new Response("Not found", { status: 404 });
}
export const POST = GET;
