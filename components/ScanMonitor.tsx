'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, X, Eye, EyeOff, Trash2, AlertCircle, CheckCircle, Play, Square, Clock, RefreshCw } from 'lucide-react';

interface ScanLog {
  id: string;
  createdAt: Date;
  level: 'info' | 'error' | 'success' | 'warning';
  message: string;
  scanId: string;
}

interface Scan {
  id: string;
  type: 'scheduled' | 'manual' | 'rescrape';
  status: 'running' | 'completed' | 'cancelled' | 'error';
  startedAt: Date;
  completedAt?: Date | null;
  progress: number;
  total: number;
  currentItem?: string | null;
  topicName?: string | null;
  platform?: string | null;
  logs?: ScanLog[];
}

interface ScanMonitorProps {
  onClose: () => void;
}

export default function ScanMonitor({ onClose }: ScanMonitorProps) {
  const [scans, setScans] = useState<Scan[]>([]);
  const [selectedScan, setSelectedScan] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);

  const fetchScans = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/scans');
      const data = await response.json();
      
      if (data.scans) {
        // Convert date strings back to Date objects
        const scansWithDates = data.scans.map((scan: any) => ({
          ...scan,
          startedAt: new Date(scan.startedAt),
          completedAt: scan.completedAt ? new Date(scan.completedAt) : null,
          logs: scan.logs?.map((log: any) => ({
            ...log,
            createdAt: new Date(log.createdAt)
          })) || []
        }));
        setScans(scansWithDates);
      }
    } catch (error) {
      console.error('Failed to fetch scans:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const cancelScan = async (scanId: string) => {
    try {
      const response = await fetch(`/api/scans/${scanId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchScans(); // Refresh to show updated status
      }
    } catch (error) {
      console.error('Failed to cancel scan:', error);
    }
  };

  const clearCompleted = async () => {
    try {
      const response = await fetch('/api/scans?action=clearCompleted', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        fetchScans();
      }
    } catch (error) {
      console.error('Failed to clear completed scans:', error);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchScans();

    // Set up SSE connection for real-time updates
    const eventSource = new EventSource('/api/scans/stream');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'connected') {
          setConnected(true);
        } else if (data.type === 'update' && data.scans) {
          // Update scans with real-time data
          const updatedScans = data.scans.map((scan: any) => ({
            ...scan,
            startedAt: new Date(scan.startedAt),
            completedAt: scan.completedAt ? new Date(scan.completedAt) : null,
            logs: scan.logs?.map((log: any) => ({
              ...log,
              createdAt: new Date(log.createdAt)
            })) || []
          }));
          
          setScans(prevScans => {
            // Merge updated scans with existing ones
            const scanMap = new Map(prevScans.map(scan => [scan.id, scan]));
            updatedScans.forEach((scan: Scan) => {
              scanMap.set(scan.id, scan);
            });
            return Array.from(scanMap.values()).sort((a, b) => 
              b.startedAt.getTime() - a.startedAt.getTime()
            );
          });
        }
      } catch (error) {
        console.error('Error processing SSE message:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      setConnected(false);
      // Fallback to manual refresh on error
      setTimeout(fetchScans, 2000);
    };
    
    return () => {
      eventSource.close();
    };
  }, [fetchScans]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Play className="w-4 h-4 text-blue-500" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'cancelled': return <Square className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const visibleScans = showCompleted 
    ? scans 
    : scans.filter(scan => scan.status === 'running');

  const selectedScanData = scans.find(s => s.id === selectedScan);
  const displayLogs = selectedScanData?.logs || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Scan Monitor</h2>
            <button
              onClick={fetchScans}
              disabled={refreshing}
              className="p-1 hover:bg-gray-100 rounded"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {connected && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                Live
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Active Scans */}
          <div className="w-1/2 border-r flex flex-col">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Active Scans ({visibleScans.length})</h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className="flex items-center space-x-1 px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    {showCompleted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showCompleted ? 'Hide' : 'Show'} Completed</span>
                  </button>
                  <button
                    onClick={clearCompleted}
                    className="flex items-center space-x-1 px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-2">
              {visibleScans.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No active scans</p>
              ) : (
                visibleScans.map(scan => (
                  <div
                    key={scan.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedScan === scan.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedScan(scan.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(scan.status)}
                        <div>
                          <div className="font-medium text-sm">
                            {scan.type === 'scheduled' ? 'Scheduled Search' : 
                             scan.type === 'manual' ? 'Manual Search' : 'Re-scrape'}
                            {scan.topicName && ` - ${scan.topicName}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            {scan.platform && `${scan.platform} • `}Started {scan.startedAt.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      {scan.status === 'running' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cancelScan(scan.id);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Cancel scan"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {scan.total > 0 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>{scan.progress} / {scan.total}</span>
                          <span>{Math.round((scan.progress / scan.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ 
                              width: `${Math.min((scan.progress / scan.total) * 100, 100)}%` 
                            }}
                          />
                        </div>
                        {scan.currentItem && (
                          <div className="text-xs text-gray-500 mt-1 truncate">
                            {scan.currentItem}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Panel - Logs */}
          <div className="w-1/2 flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-medium">
                {selectedScanData ? (
                  <span>
                    Logs for {selectedScanData.type} {selectedScanData.topicName && `- ${selectedScanData.topicName}`}
                  </span>
                ) : (
                  'Select a scan to view logs'
                )}
              </h3>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <div className="space-y-1 font-mono text-sm">
                {displayLogs.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No logs available</p>
                ) : (
                  displayLogs.map(log => (
                    <div key={log.id} className="flex space-x-2">
                      <span className="text-gray-400 flex-shrink-0">
                        {log.createdAt.toLocaleTimeString()}
                      </span>
                      <span className={`font-medium flex-shrink-0 ${getLogLevelColor(log.level)}`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="text-gray-700">{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}