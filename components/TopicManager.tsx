'use client';

import { useState } from 'react';
import { Plus, Trash2, Play, Pause, RefreshCw } from 'lucide-react';

interface Topic {
  id: string;
  name: string;
  platform: string;
  active: boolean;
  createdAt: string;
  _count?: {
    searches: number;
  };
}

interface TopicManagerProps {
  topics: Topic[];
  onAddTopic: (name: string, platform: string) => void;
  onToggleTopic: (id: string, active: boolean) => void;
  onDeleteTopic: (id: string) => void;
  onManualSearch: (id: string) => void;
}

export default function TopicManager({ 
  topics, 
  onAddTopic, 
  onToggleTopic, 
  onDeleteTopic,
  onManualSearch 
}: TopicManagerProps) {
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicPlatform, setNewTopicPlatform] = useState('YOUTUBE');
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAddTopic = () => {
    if (newTopicName.trim()) {
      onAddTopic(newTopicName, newTopicPlatform);
      setNewTopicName('');
      setNewTopicPlatform('YOUTUBE');
      setShowAddForm(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Search Topics</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Topic
        </button>
      </div>

      {showAddForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-md">
          <div className="space-y-3">
            <div className="flex space-x-2">
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter topic name (e.g., 'meta quest', 'AI tools')"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={newTopicPlatform}
                onChange={(e) => setNewTopicPlatform(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="YOUTUBE">YouTube</option>
                <option value="TIKTOK">TikTok</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="TWITTER">Twitter/X</option>
              </select>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleAddTopic}
                className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Add Topic
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewTopicName('');
                  setNewTopicPlatform('YOUTUBE');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {topics.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No topics added yet. Add a topic to start searching for influencers.</p>
        ) : (
          topics.map(topic => (
            <div key={topic.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onToggleTopic(topic.id, !topic.active)}
                  className={`p-2 rounded-full ${topic.active ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-400'}`}
                >
                  {topic.active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                </button>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-medium text-gray-900">{topic.name}</p>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      topic.platform === 'YOUTUBE' ? 'bg-red-100 text-red-800' : 
                      topic.platform === 'TIKTOK' ? 'bg-black text-white' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {topic.platform}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {topic._count?.searches || 0} searches performed
                    {topic.active && <span className="ml-2 text-green-600">• Active</span>}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onManualSearch(topic.id)}
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                  title="Run search now"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDeleteTopic(topic.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md"
                  title="Delete topic"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-md">
        <p className="text-sm text-blue-800">
          <strong>Auto-Search:</strong> Active topics are automatically searched every 4 hours for videos from the last 24 hours.
        </p>
      </div>
    </div>
  );
}