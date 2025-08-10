import { NextResponse } from 'next/server';
import { initializeSchedulers } from '@/lib/scheduler-init';

// This route is called once on startup to initialize schedulers
export async function GET() {
  try {
    await initializeSchedulers();
    return NextResponse.json({ success: true, message: 'Schedulers initialized' });
  } catch (error) {
    console.error('[API] Failed to initialize schedulers:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to initialize schedulers' 
    }, { status: 500 });
  }
}