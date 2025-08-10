import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`));
      
      let lastCheckTime = new Date();
      
      const interval = setInterval(async () => {
        try {
          // Get scans updated since last check
          const scans = await prisma.scan.findMany({
            where: {
              OR: [
                { status: 'running' },
                { updatedAt: { gte: lastCheckTime } }
              ]
            },
            include: {
              logs: {
                where: { createdAt: { gte: lastCheckTime } },
                orderBy: { createdAt: 'desc' },
                take: 10
              }
            },
            orderBy: { startedAt: 'desc' }
          });
          
          if (scans.length > 0) {
            const data = JSON.stringify({ 
              type: 'update', 
              scans,
              timestamp: new Date()
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          
          // Send heartbeat to keep connection alive
          controller.enqueue(encoder.encode(`:heartbeat\n\n`));
          
          lastCheckTime = new Date();
        } catch (error) {
          console.error('SSE error:', error);
          controller.error(error);
        }
      }, 2000); // Update every 2 seconds
      
      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}