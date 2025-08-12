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
      
      let lastLogCheck = new Date(Date.now() - 60000); // Start checking from 1 minute ago
      
      const interval = setInterval(async () => {
        try {
          // Get all active scans (running or recently completed)
          const scans = await prisma.scan.findMany({
            where: {
              OR: [
                { status: 'running' },
                { 
                  AND: [
                    { status: { not: 'running' } },
                    { completedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } } // Keep completed scans for 30 minutes
                  ]
                }
              ]
            },
            include: {
              logs: true // Simplified - get all logs without conditions
            },
            orderBy: { startedAt: 'desc' }
          });
          
          // Debug logging
          console.log(`[SSE] Found ${scans.length} scans, total logs: ${scans.reduce((sum, s) => sum + (s.logs?.length || 0), 0)}`);
          
          // Also get only new logs since last check for incremental updates
          const newLogs = await prisma.scanLog.findMany({
            where: {
              createdAt: { gt: lastLogCheck },
              scan: {
                OR: [
                  { status: 'running' },
                  { 
                    AND: [
                      { status: { not: 'running' } },
                      { completedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } }
                    ]
                  }
                ]
              }
            },
            include: {
              scan: {
                select: { id: true }
              }
            }
          });
          
          if (scans.length > 0 || newLogs.length > 0) {
            const data = JSON.stringify({ 
              type: 'update', 
              scans,
              newLogs,
              timestamp: new Date()
            });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          
          // Send heartbeat to keep connection alive
          controller.enqueue(encoder.encode(`:heartbeat\n\n`));
          
          lastLogCheck = new Date();
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