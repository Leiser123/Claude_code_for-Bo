/**
 * Chat feature — simplified placeholder.
 * Returns a hint message indicating API key configuration is needed.
 */

/**
 * POST /api/wiki/chat
 */
export async function handleChat(_req: Request): Promise<Response> {
  return Response.json({
    success: false,
    answer: "Chat feature requires API key configuration",
  })
}

/**
 * POST /api/wiki/chat-stream
 */
export async function handleChatStream(_req: Request): Promise<Response> {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const msg = JSON.stringify({ content: "Chat feature requires API key configuration" })
      controller.enqueue(encoder.encode(`data: ${msg}\n\n`))
      controller.enqueue(encoder.encode("data: [DONE]\n\n"))
      controller.close()
    },
  })
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
