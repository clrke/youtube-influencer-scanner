'use client';

import { useState } from 'react';
import { ExternalLink, MessageSquare, Users, Video, Eye, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface InfluencerCardProps {
  influencer: {
    id: string;
    status: string;
    channelTitle: string;
    subscriberCount: number;
    thumbnailUrl?: string;
    description?: string;
    channelUrl: string;
    lastContactedAt?: string;
    _count: { videos: number };
    videos?: Array<{ id: string; title: string; videoUrl: string; viewCount: number }>;
  };
  onStatusChange: (id: string, status: string) => void;
  onOutreach: (id: string, message: string) => void;
}

export default function InfluencerCard({ influencer, onStatusChange, onOutreach }: InfluencerCardProps) {
  const [showOutreachForm, setShowOutreachForm] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState('');

  const statusColors = {
    NEW: 'bg-blue-100 text-blue-800',
    CONTACTED: 'bg-yellow-100 text-yellow-800',
    RESPONDED: 'bg-green-100 text-green-800',
    NEGOTIATING: 'bg-purple-100 text-purple-800',
    CONVERTED: 'bg-emerald-100 text-emerald-800',
    NOT_INTERESTED: 'bg-gray-100 text-gray-800',
    BLACKLISTED: 'bg-red-100 text-red-800'
  };

  const statusIcons = {
    NEW: <AlertCircle className="w-4 h-4" />,
    CONTACTED: <Clock className="w-4 h-4" />,
    RESPONDED: <MessageSquare className="w-4 h-4" />,
    NEGOTIATING: <MessageSquare className="w-4 h-4" />,
    CONVERTED: <CheckCircle className="w-4 h-4" />,
    NOT_INTERESTED: <XCircle className="w-4 h-4" />,
    BLACKLISTED: <XCircle className="w-4 h-4" />
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleOutreach = () => {
    if (outreachMessage.trim()) {
      onOutreach(influencer.id, outreachMessage);
      setOutreachMessage('');
      setShowOutreachForm(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          {influencer.thumbnailUrl && (
            <img alt={influencer.channelTitle} 
              src={influencer.thumbnailUrl}
              className="w-16 h-16 rounded-full object-cover"
            />
          )}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{influencer.channelTitle}</h3>
            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
              <span className="flex items-center">
                <Users className="w-4 h-4 mr-1" />
                {formatNumber(influencer.subscriberCount)} subscribers
              </span>
              <span className="flex items-center">
                <Video className="w-4 h-4 mr-1" />
                {influencer._count.videos} videos tracked
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${statusColors[influencer.status as keyof typeof statusColors]}`}>
            {statusIcons[influencer.status as keyof typeof statusIcons]}
            <span className="ml-1">{influencer.status.replace('_', ' ')}</span>
          </span>
        </div>
      </div>

      {influencer.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{influencer.description}</p>
      )}

      {influencer.videos && influencer.videos.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Videos:</h4>
          <div className="space-y-2">
            {influencer.videos.slice(0, 2).map((video: { id: string; title: string; videoUrl: string; viewCount: number }) => (
              <div key={video.id} className="flex items-center justify-between text-sm">
                <a 
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline truncate flex-1 mr-2"
                >
                  {video.title}
                </a>
                <div className="flex items-center text-gray-500">
                  <Eye className="w-3 h-3 mr-1" />
                  {formatNumber(video.viewCount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {influencer.lastContactedAt && (
        <p className="text-xs text-gray-500 mb-4">
          Last contacted {formatDistanceToNow(new Date(influencer.lastContactedAt))} ago
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex space-x-2">
          <a
            href={influencer.channelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <ExternalLink className="w-4 h-4 mr-1" />
            View Channel
          </a>
          
          {influencer.status === 'NEW' && (
            <button
              onClick={() => setShowOutreachForm(!showOutreachForm)}
              className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Reach Out
            </button>
          )}
        </div>

        <select
          value={influencer.status}
          onChange={(e) => onStatusChange(influencer.id, e.target.value)}
          className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="RESPONDED">Responded</option>
          <option value="NEGOTIATING">Negotiating</option>
          <option value="CONVERTED">Converted</option>
          <option value="NOT_INTERESTED">Not Interested</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
      </div>

      {showOutreachForm && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <textarea
            value={outreachMessage}
            onChange={(e) => setOutreachMessage(e.target.value)}
            placeholder="Enter your outreach message..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <div className="mt-2 flex justify-end space-x-2">
            <button
              onClick={() => setShowOutreachForm(false)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleOutreach}
              className="px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Send & Mark as Contacted
            </button>
          </div>
        </div>
      )}
    </div>
  );
}