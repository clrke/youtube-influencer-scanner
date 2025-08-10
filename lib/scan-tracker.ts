interface ScanLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'error' | 'success' | 'warning';
  message: string;
  scanId: string;
}

interface ActiveScan {
  id: string;
  type: 'scheduled' | 'manual' | 'rescrape';
  topicName?: string;
  platform?: string;
  status: 'running' | 'completed' | 'cancelled' | 'error';
  startedAt: Date;
  completedAt?: Date;
  progress?: {
    current: number;
    total: number;
    currentItem?: string;
  };
  logs: ScanLog[];
  abortController?: AbortController;
}

class ScanTracker {
  private static instance: ScanTracker;
  private activeScans: Map<string, ActiveScan> = new Map();
  private scanLogs: ScanLog[] = [];
  private maxLogsPerScan = 100;
  private maxTotalLogs = 1000;

  static getInstance(): ScanTracker {
    if (!ScanTracker.instance) {
      ScanTracker.instance = new ScanTracker();
    }
    return ScanTracker.instance;
  }

  startScan(
    id: string, 
    type: 'scheduled' | 'manual' | 'rescrape', 
    options: { 
      topicName?: string; 
      platform?: string; 
      abortController?: AbortController 
    } = {}
  ): void {
    const scan: ActiveScan = {
      id,
      type,
      topicName: options.topicName,
      platform: options.platform,
      status: 'running',
      startedAt: new Date(),
      logs: [],
      abortController: options.abortController
    };

    this.activeScans.set(id, scan);
    this.log(id, 'info', `${type} scan started${options.topicName ? ` for "${options.topicName}"` : ''}${options.platform ? ` on ${options.platform}` : ''}`);
  }

  updateProgress(scanId: string, current: number, total: number, currentItem?: string): void {
    const scan = this.activeScans.get(scanId);
    if (scan) {
      scan.progress = { current, total, currentItem };
      this.activeScans.set(scanId, scan);
    }
  }

  log(scanId: string, level: ScanLog['level'], message: string): void {
    const logEntry: ScanLog = {
      id: `${scanId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      scanId
    };

    // Add to global logs
    this.scanLogs.unshift(logEntry);
    if (this.scanLogs.length > this.maxTotalLogs) {
      this.scanLogs = this.scanLogs.slice(0, this.maxTotalLogs);
    }

    // Add to scan-specific logs
    const scan = this.activeScans.get(scanId);
    if (scan) {
      scan.logs.unshift(logEntry);
      if (scan.logs.length > this.maxLogsPerScan) {
        scan.logs = scan.logs.slice(0, this.maxLogsPerScan);
      }
      this.activeScans.set(scanId, scan);
    }

    console.log(`[ScanTracker] [${scanId}] [${level.toUpperCase()}] ${message}`);
  }

  completeScan(scanId: string, status: 'completed' | 'cancelled' | 'error', finalMessage?: string): void {
    const scan = this.activeScans.get(scanId);
    if (scan) {
      scan.status = status;
      scan.completedAt = new Date();
      this.activeScans.set(scanId, scan);
      
      if (finalMessage) {
        this.log(scanId, status === 'completed' ? 'success' : status === 'error' ? 'error' : 'warning', finalMessage);
      }

      // Remove from active scans after 5 minutes
      setTimeout(() => {
        this.activeScans.delete(scanId);
      }, 5 * 60 * 1000);
    }
  }

  cancelScan(scanId: string): boolean {
    const scan = this.activeScans.get(scanId);
    if (scan && scan.status === 'running') {
      // Signal abort if controller is available
      if (scan.abortController) {
        scan.abortController.abort();
      }
      
      this.completeScan(scanId, 'cancelled', 'Scan cancelled by user');
      return true;
    }
    return false;
  }

  getActiveScans(): ActiveScan[] {
    return Array.from(this.activeScans.values());
  }

  getScanById(scanId: string): ActiveScan | undefined {
    return this.activeScans.get(scanId);
  }

  getAllLogs(): ScanLog[] {
    return this.scanLogs;
  }

  getLogsByScan(scanId: string): ScanLog[] {
    return this.scanLogs.filter(log => log.scanId === scanId);
  }

  clearCompletedScans(): void {
    for (const [scanId, scan] of this.activeScans.entries()) {
      if (scan.status !== 'running') {
        this.activeScans.delete(scanId);
      }
    }
  }
}

export default ScanTracker;
export type { ActiveScan, ScanLog };