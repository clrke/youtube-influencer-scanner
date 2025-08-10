import { prisma } from './db';
import { Prisma } from '@prisma/client';

export type ScanType = 'scheduled' | 'manual' | 'rescrape';
export type ScanStatus = 'running' | 'completed' | 'cancelled' | 'error';
export type LogLevel = 'info' | 'error' | 'success' | 'warning';

class ScanService {
  private static instance: ScanService;

  static getInstance(): ScanService {
    if (!ScanService.instance) {
      ScanService.instance = new ScanService();
    }
    return ScanService.instance;
  }

  async createScan(
    type: ScanType,
    options: {
      topicId?: string;
      topicName?: string;
      platform?: string;
      total?: number;
    } = {}
  ) {
    const scan = await prisma.scan.create({
      data: {
        type,
        status: 'running',
        topicId: options.topicId,
        topicName: options.topicName,
        platform: options.platform,
        total: options.total || 0,
        startedAt: new Date()
      }
    });

    await this.log(scan.id, 'info', `${type} scan started${options.topicName ? ` for "${options.topicName}"` : ''}${options.platform ? ` on ${options.platform}` : ''}`);
    
    return scan;
  }

  async updateProgress(
    scanId: string,
    progress: number,
    currentItem?: string
  ) {
    return await prisma.scan.update({
      where: { id: scanId },
      data: {
        progress,
        currentItem
      }
    });
  }

  async log(
    scanId: string,
    level: LogLevel,
    message: string
  ) {
    console.log(`[Scan ${scanId}] [${level.toUpperCase()}] ${message}`);
    
    return await prisma.scanLog.create({
      data: {
        scanId,
        level,
        message
      }
    });
  }

  async completeScan(
    scanId: string,
    status: ScanStatus,
    finalMessage?: string
  ) {
    if (finalMessage) {
      await this.log(
        scanId,
        status === 'completed' ? 'success' : status === 'error' ? 'error' : 'warning',
        finalMessage
      );
    }

    return await prisma.scan.update({
      where: { id: scanId },
      data: {
        status,
        completedAt: new Date()
      }
    });
  }

  async checkShouldCancel(scanId: string): Promise<boolean> {
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { shouldCancel: true }
    });
    
    return scan?.shouldCancel || false;
  }

  async cancelScan(scanId: string): Promise<boolean> {
    try {
      const scan = await prisma.scan.findUnique({
        where: { id: scanId },
        select: { status: true }
      });

      if (scan?.status === 'running') {
        // Set the cancel flag
        await prisma.scan.update({
          where: { id: scanId },
          data: { shouldCancel: true }
        });
        
        // The running process will check this flag and stop
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error cancelling scan:', error);
      return false;
    }
  }

  async getActiveScans() {
    return await prisma.scan.findMany({
      where: {
        OR: [
          { status: 'running' },
          {
            AND: [
              { status: { not: 'running' } },
              { completedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) } } // Last 30 minutes
            ]
          }
        ]
      },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      },
      orderBy: { startedAt: 'desc' }
    });
  }

  async getScanById(scanId: string) {
    return await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        logs: {
          orderBy: { createdAt: 'desc' },
          take: 100
        }
      }
    });
  }

  async getRecentLogs(limit: number = 100) {
    return await prisma.scanLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        scan: {
          select: {
            type: true,
            topicName: true,
            platform: true
          }
        }
      }
    });
  }

  async cleanupOldScans(daysToKeep: number = 7) {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    return await prisma.scan.deleteMany({
      where: {
        AND: [
          { status: { not: 'running' } },
          { createdAt: { lt: cutoffDate } }
        ]
      }
    });
  }
}

export default ScanService;