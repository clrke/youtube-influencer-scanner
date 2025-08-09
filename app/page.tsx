'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Filter, BarChart3, Users, PlayCircle } from 'lucide-react';
import InfluencerCard from '@/components/InfluencerCard';
import TopicManager from '@/components/TopicManager';
import Analytics from '@/components/Analytics';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'influencers' | 'topics' | 'analytics'>('influencers');
  const [influencers, setInfluencers] = useState<Array<{ id: string; status: string; channelTitle: string; subscriberCount: number; _count: { videos: number }; videos?: Array<{ id: string; title: string; videoUrl: string; viewCount: number }>; lastContactedAt?: string }>>([]);
  const [topics, setTopics] = useState<Array<{ id: string; name: string; active: boolean; createdAt: string; _count?: { searches: number } }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [topicFilter, setTopicFilter] = useState('ALL');
  const [minSubscribersFilter, setMinSubscribersFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [analyticsStats, setAnalyticsStats] = useState<{ totalInfluencers: number; newThisWeek: number; contacted: number; responded: number; converted: number; conversionRate: number; avgResponseTime: number; statusBreakdown: Array<{ name: string; value: number }>; weeklyTrend: Array<{ date: string; new: number; contacted: number; converted: number }> } | null>(null);

  const fetchInfluencers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '12',
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm }),
        ...(topicFilter !== 'ALL' && { topicId: topicFilter }),
        ...(minSubscribersFilter && { minSubscribers: minSubscribersFilter }),
        ...(platformFilter !== 'ALL' && { platform: platformFilter })
      });
      
      const response = await fetch(`/api/influencers?${params}`);
      const data = await response.json();
      
      setInfluencers(data.influencers || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Failed to fetch influencers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, searchTerm, topicFilter, minSubscribersFilter, platformFilter]);

  const fetchTopics = async () => {
    try {
      const response = await fetch('/api/topics');
      const data = await response.json();
      setTopics(data || []);
    } catch (error) {
      console.error('Failed to fetch topics:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalyticsStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    }
  };

  // Reset to page 1 when filters change (except currentPage itself)
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [statusFilter, searchTerm, topicFilter, minSubscribersFilter, platformFilter]);

  useEffect(() => {
    fetchInfluencers();
  }, [currentPage, statusFilter, searchTerm, topicFilter, minSubscribersFilter, platformFilter, fetchInfluencers]);

  useEffect(() => {
    fetchTopics();
    fetchAnalytics();
  }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/influencers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        fetchInfluencers();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleOutreach = async (id: string, message: string) => {
    try {
      const response = await fetch(`/api/influencers/${id}/outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      
      if (response.ok) {
        fetchInfluencers();
        fetchAnalytics();
      }
    } catch (error) {
      console.error('Failed to create outreach:', error);
    }
  };

  const handleAddTopic = async (name: string, platform: string) => {
    try {
      const response = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, platform })
      });
      
      if (response.ok) {
        fetchTopics();
      }
    } catch (error) {
      console.error('Failed to add topic:', error);
    }
  };

  const handleToggleTopic = async (id: string, active: boolean) => {
    try {
      const response = await fetch(`/api/topics/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
      
      if (response.ok) {
        fetchTopics();
      }
    } catch (error) {
      console.error('Failed to toggle topic:', error);
    }
  };

  const handleDeleteTopic = async (id: string) => {
    if (confirm('Are you sure you want to delete this topic?')) {
      try {
        const response = await fetch(`/api/topics/${id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          fetchTopics();
        }
      } catch (error) {
        console.error('Failed to delete topic:', error);
      }
    }
  };

  const handleManualSearch = async (id: string) => {
    try {
      const response = await fetch(`/api/topics/${id}/search`, {
        method: 'POST'
      });
      
      if (response.ok) {
        fetchInfluencers();
      }
    } catch (error) {
      console.error('Failed to trigger search:', error);
    }
  };

  // Mock analytics data (replace with real data from API)
  const mockAnalytics = {
    totalInfluencers: influencers.length,
    newThisWeek: 23,
    contacted: influencers.filter(i => i.status !== 'NEW').length,
    responded: influencers.filter(i => ['RESPONDED', 'NEGOTIATING', 'CONVERTED'].includes(i.status)).length,
    converted: influencers.filter(i => i.status === 'CONVERTED').length,
    conversionRate: 12.5,
    avgResponseTime: 18,
    statusBreakdown: [
      { name: 'New', value: influencers.filter(i => i.status === 'NEW').length },
      { name: 'Contacted', value: influencers.filter(i => i.status === 'CONTACTED').length },
      { name: 'Responded', value: influencers.filter(i => i.status === 'RESPONDED').length },
      { name: 'Negotiating', value: influencers.filter(i => i.status === 'NEGOTIATING').length },
      { name: 'Converted', value: influencers.filter(i => i.status === 'CONVERTED').length }
    ],
    weeklyTrend: [
      { date: 'Mon', new: 5, contacted: 3, converted: 1 },
      { date: 'Tue', new: 8, contacted: 6, converted: 2 },
      { date: 'Wed', new: 6, contacted: 4, converted: 1 },
      { date: 'Thu', new: 10, contacted: 7, converted: 3 },
      { date: 'Fri', new: 12, contacted: 9, converted: 2 },
      { date: 'Sat', new: 4, contacted: 2, converted: 1 },
      { date: 'Sun', new: 3, contacted: 1, converted: 0 }
    ]
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <PlayCircle className="w-8 h-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-bold text-gray-900">YouTube Influencer Scanner</h1>
            </div>
            
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab('influencers')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'influencers' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4 mr-1" />
                Influencers
              </button>
              <button
                onClick={() => setActiveTab('topics')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'topics' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Search className="w-4 h-4 mr-1" />
                Topics
              </button>
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  activeTab === 'analytics' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4 mr-1" />
                Analytics
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'influencers' && (
          <div>
            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search influencers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Filter className="text-gray-400 w-5 h-5" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Status</option>
                    <option value="NEW">New</option>
                    <option value="CONTACTED">Contacted</option>
                    <option value="RESPONDED">Responded</option>
                    <option value="NEGOTIATING">Negotiating</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="NOT_INTERESTED">Not Interested</option>
                    <option value="BLACKLISTED">Blacklisted</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={topicFilter}
                    onChange={(e) => setTopicFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Topics</option>
                    {topics.map(topic => (
                      <option key={topic.id} value={topic.id}>{topic.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    placeholder="Min subscribers"
                    value={minSubscribersFilter}
                    onChange={(e) => setMinSubscribersFilter(e.target.value)}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Platforms</option>
                    <option value="YOUTUBE">YouTube</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="TWITTER">Twitter</option>
                  </select>
                </div>

                {(statusFilter !== 'ALL' || topicFilter !== 'ALL' || searchTerm || minSubscribersFilter || platformFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setStatusFilter('ALL');
                      setTopicFilter('ALL');
                      setSearchTerm('');
                      setMinSubscribersFilter('');
                      setPlatformFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : influencers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No influencers found. Add topics to start discovering influencers.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {influencers.map(influencer => (
                    <InfluencerCard
                      key={influencer.id}
                      influencer={influencer}
                      onStatusChange={handleStatusChange}
                      onOutreach={handleOutreach}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'topics' && (
          <TopicManager
            topics={topics}
            onAddTopic={handleAddTopic}
            onToggleTopic={handleToggleTopic}
            onDeleteTopic={handleDeleteTopic}
            onManualSearch={handleManualSearch}
          />
        )}

        {activeTab === 'analytics' && (
          <Analytics stats={analyticsStats || mockAnalytics} />
        )}
      </main>
    </div>
  );
}
