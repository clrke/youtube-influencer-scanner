import { NextRequest, NextResponse } from 'next/server';
import ScanService from '@/lib/scan-service';

export async function GET(request: NextRequest) {
  try {
    const scanService = ScanService.getInstance();
    const searchParams = request.nextUrl.searchParams;
    const includeLogs = searchParams.get('includeLogs') === 'true';
    
    const activeScans = await scanService.getActiveScans();
    
    if (includeLogs) {
      const recentLogs = await scanService.getRecentLogs(100);
      return NextResponse.json({
        scans: activeScans,
        logs: recentLogs
      });
    }
    
    return NextResponse.json({ scans: activeScans });
  } catch (error) {
    console.error('Error fetching scans:', error);
    return NextResponse.json({ error: 'Failed to fetch scans' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    
    const scanService = ScanService.getInstance();
    
    if (action === 'clearCompleted') {
      await scanService.cleanupOldScans(0); // Clear all completed scans
      return NextResponse.json({ success: true, message: 'Completed scans cleared' });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing scans:', error);
    return NextResponse.json({ error: 'Failed to manage scans' }, { status: 500 });
  }
}