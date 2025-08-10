import { NextRequest, NextResponse } from 'next/server';
import ScanService from '@/lib/scan-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const resolvedParams = await params;
    const scanService = ScanService.getInstance();
    const scan = await scanService.getScanById(resolvedParams.scanId);
    
    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }
    
    return NextResponse.json({ scan });
  } catch (error) {
    console.error('Error fetching scan:', error);
    return NextResponse.json({ error: 'Failed to fetch scan' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const resolvedParams = await params;
    const scanService = ScanService.getInstance();
    const cancelled = await scanService.cancelScan(resolvedParams.scanId);
    
    if (!cancelled) {
      return NextResponse.json({ 
        error: 'Scan not found or not running' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Scan cancellation requested' 
    });
  } catch (error) {
    console.error('Error cancelling scan:', error);
    return NextResponse.json({ error: 'Failed to cancel scan' }, { status: 500 });
  }
}