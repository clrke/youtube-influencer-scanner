'use client';

import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, MessageSquare, Target, Clock } from 'lucide-react';

interface AnalyticsProps {
  stats: {
    totalInfluencers: number;
    newThisWeek: number;
    contacted: number;
    responded: number;
    converted: number;
    conversionRate: number;
    avgResponseTime: number;
    statusBreakdown: Array<{ name: string; value: number }>;
    weeklyTrend: Array<{ date: string; new: number; contacted: number; converted: number }>;
  };
}

export default function Analytics({ stats }: AnalyticsProps) {
  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280', '#EC4899'];

  const metrics = [
    {
      title: 'Total Influencers',
      value: stats.totalInfluencers,
      change: `+${stats.newThisWeek} this week`,
      icon: Users,
      color: 'bg-blue-500'
    },
    {
      title: 'Contacted',
      value: stats.contacted,
      change: `${((stats.contacted / stats.totalInfluencers) * 100).toFixed(1)}% of total`,
      icon: MessageSquare,
      color: 'bg-yellow-500'
    },
    {
      title: 'Response Rate',
      value: `${((stats.responded / stats.contacted) * 100 || 0).toFixed(1)}%`,
      change: `${stats.responded} responded`,
      icon: TrendingUp,
      color: 'bg-green-500'
    },
    {
      title: 'Conversion Rate',
      value: `${stats.conversionRate.toFixed(1)}%`,
      change: `${stats.converted} converted`,
      icon: Target,
      color: 'bg-purple-500'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                <p className="text-xs text-gray-500 mt-1">{metric.change}</p>
              </div>
              <div className={`${metric.color} p-3 rounded-full bg-opacity-10`}>
                <metric.icon className={`w-6 h-6 ${metric.color.replace('bg-', 'text-')}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.statusBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.statusBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Activity</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="new" stroke="#3B82F6" name="New" />
              <Line type="monotone" dataKey="contacted" stroke="#F59E0B" name="Contacted" />
              <Line type="monotone" dataKey="converted" stroke="#10B981" name="Converted" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-900">Best Day for Outreach</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">Tuesday</p>
                <p className="text-xs text-blue-700 mt-1">32% higher response rate</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          
          <div className="p-4 bg-green-50 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-900">Avg. Response Time</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{stats.avgResponseTime}h</p>
                <p className="text-xs text-green-700 mt-1">From first contact</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-900">Top Converting Topic</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">Meta Quest</p>
                <p className="text-xs text-purple-700 mt-1">18% conversion rate</p>
              </div>
              <Target className="w-8 h-8 text-purple-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}