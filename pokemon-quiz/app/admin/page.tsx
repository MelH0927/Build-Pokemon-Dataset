'use client';

import React, { useState, useEffect, useCallback } from 'react';

type ResultsData = {
  summary: {
    totalParticipants: number;
    overallAccuracy: number;
    levelDistribution: Record<number, { count: number; avgAccuracy: number; totalAccuracy: number }>;
    recentParticipants: number;
  };
  typeAccuracy: Record<string, { accuracy: number; totalQuestions: number; correctAnswers: number }>;
  distributions: Array<{
    date: string;
    level1Count: number;
    level2Count: number;
    level3Count: number;
    questionnaire1Assigned: number;
    questionnaire2Assigned: number;
    questionnaire3Assigned: number;
  }>;
  recentResults: Array<{
    sessionId: string;
    participantName?: string;
    knowledgeLevel: number;
    questionnaireId: number;
    overallAccuracy: number;
    totalQuestions: number;
    correctAnswers: number;
    completedAt: string;
  }>;
  lastUpdated: string;
};

type PartialProgressData = {
  activeSessions: Array<{
    sessionId: string;
    participantName?: string;
    knowledgeLevel: number;
    questionnaireId: number;
    progress: number;
    currentQuestion: number;
    totalQuestions: number;
    correctAnswers: number;
    accuracy: number;
    startTime: string;
    lastActivity: string;
    isPaused: boolean;
    timeElapsed: number;
  }>;
  totalActive: number;
  paused: number;
  active: number;
  lastUpdated: string;
};

const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A', fire: '#EE8130', water: '#6390F0', electric: '#F7D02C',
  grass: '#7AC74C', ice: '#96D9D6', fighting: '#C22E28', poison: '#A33EA1',
  ground: '#E2BF65', flying: '#A98FF3', psychic: '#F95587', bug: '#A6B91A',
  rock: '#B6A136', ghost: '#735797', dragon: '#6F35FC', dark: '#705746',
  steel: '#B7B7CE', fairy: '#D685AD',
};

const KNOWLEDGE_LEVELS = ['Beginner', 'Intermediate', 'Expert'];

export default function AdminDashboard() {
  const [data, setData] = useState<ResultsData | null>(null);
  const [progressData, setProgressData] = useState<PartialProgressData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{
    success: boolean;
    message: string;
    details: {
      answers?: number;
      results?: number;
      participations?: number;
      total: number;
      cutoffDate?: string;
      daysOld?: number;
      staleDate?: string;
    };
    timestamp: string;
  } | null>(null);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [cleanupType, setCleanupType] = useState('old');
  const [daysOld, setDaysOld] = useState('30');

  const fetchResults = useCallback(async () => {
    if (!adminKey.trim()) {
      setError('Please enter admin key');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/quiz/results?key=${encodeURIComponent(adminKey)}`);
      
      if (response.status === 401) {
        setError('Invalid admin key');
        setAuthenticated(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const results = await response.json();
      setData(results);
      setAuthenticated(true);
      
      // Also fetch partial progress on initial load
      await fetchPartialProgress();
    } catch (err) {
      setError('Failed to fetch results: ' + (err as Error).message);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, [adminKey]);

  const fetchPartialProgress = useCallback(async () => {
    if (!adminKey.trim()) return;

    try {
      const response = await fetch(`/api/quiz/progress?key=${encodeURIComponent(adminKey)}`);
      
      if (response.status === 401) {
        setError('Invalid admin key');
        setAuthenticated(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const progress = await response.json();
      setProgressData(progress);
    } catch (err) {
      console.error('Failed to fetch partial progress:', err);
      // Don't set error here as it might interfere with main data
    }
  }, [adminKey]);

  const performCleanup = async () => {
    if (!adminKey.trim()) {
      setError('Please enter admin key');
      return;
    }

    setCleanupLoading(true);
    setError('');
    setCleanupResult(null);

    try {
      const params = new URLSearchParams({
        key: adminKey,
        type: cleanupType,
        ...(cleanupType === 'old' && { daysOld: daysOld })
      });

      const response = await fetch(`/api/quiz/cleanup?${params}`, {
        method: 'DELETE'
      });
      
      if (response.status === 401) {
        setError('Invalid admin key');
        setAuthenticated(false);
        return;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setCleanupResult(result);
      setShowCleanupConfirm(false);
      
      // Refresh data after cleanup
      await fetchResults();
      await fetchPartialProgress();
    } catch (err) {
      setError('Failed to perform cleanup: ' + (err as Error).message);
    } finally {
      setCleanupLoading(false);
    }
  };

  // Auto-refresh every 30 seconds if authenticated
  useEffect(() => {
    if (authenticated && adminKey) {
      const interval = setInterval(() => {
        fetchResults();
        fetchPartialProgress();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [authenticated, adminKey, fetchResults, fetchPartialProgress]);

  // Fetch partial progress more frequently (every 10 seconds)
  useEffect(() => {
    if (authenticated && adminKey) {
      const interval = setInterval(() => {
        fetchPartialProgress();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [authenticated, adminKey, fetchPartialProgress]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            🔒 Admin Dashboard
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Admin Key
              </label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter admin key"
                onKeyPress={(e) => e.key === 'Enter' && fetchResults()}
              />
            </div>
            
            <button
              onClick={fetchResults}
              disabled={loading || !adminKey.trim()}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded">
                {error}
              </div>
            )}
          </div>
          
          <div className="mt-6 text-sm text-gray-600 space-y-2">
            <p>Enter one of the keys configured in the server&apos;s <code>ADMIN_KEY</code> environment variable.</p>
            <p>You can supply multiple keys by separating them with commas, e.g.:<br/>
              <code>ADMIN_KEY=first-key,second-key</code>
            </p>
            <p>Whitespace is trimmed; copy/paste issues (trailing spaces or newlines) will cause failure.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const recentDist = data.distributions[0] || {
    level1Count: 0, level2Count: 0, level3Count: 0,
    questionnaire1Assigned: 0, questionnaire2Assigned: 0, questionnaire3Assigned: 0
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            📊 Pokémon Quiz Analytics
          </h1>
          <div className="text-sm text-gray-600">
            <p>Last updated: {new Date(data.lastUpdated).toLocaleString()}</p>
            <button
              onClick={fetchResults}
              className="mt-1 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Participants</h3>
            <p className="text-3xl font-bold text-blue-600">{data.summary.totalParticipants}</p>
            <p className="text-sm text-gray-600 mt-1">
              {data.summary.recentParticipants} in last 7 days
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Overall Accuracy</h3>
            <p className="text-3xl font-bold text-green-600">{data.summary.overallAccuracy}%</p>
            <p className="text-sm text-gray-600 mt-1">Across all participants</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Today&apos;s Users</h3>
            <p className="text-lg text-gray-800">
              L1: {recentDist.level1Count} • L2: {recentDist.level2Count} • L3: {recentDist.level3Count}
            </p>
            <p className="text-sm text-gray-600 mt-1">By knowledge level</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quiz Distribution</h3>
            <p className="text-lg text-gray-800">
              Q1: {recentDist.questionnaire1Assigned} • Q2: {recentDist.questionnaire2Assigned} • Q3: {recentDist.questionnaire3Assigned}
            </p>
            <p className="text-sm text-gray-600 mt-1">Today&apos;s assignments</p>
          </div>
        </div>

        {/* Real-time Progress Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">📊 Live Progress Monitoring</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowProgress(!showProgress)}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                {showProgress ? 'Hide' : 'Show'} Live Progress
              </button>
              {progressData && (
                <span className="text-sm text-gray-600">
                  Last updated: {new Date(progressData.lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {showProgress && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Sessions</h3>
                <p className="text-3xl font-bold text-blue-600">{progressData?.totalActive || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Currently taking quizzes</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Users</h3>
                <p className="text-3xl font-bold text-green-600">{progressData?.active || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Currently answering</p>
              </div>
              
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Paused Sessions</h3>
                <p className="text-3xl font-bold text-yellow-600">{progressData?.paused || 0}</p>
                <p className="text-sm text-gray-600 mt-1">Temporarily paused</p>
              </div>
            </div>
          )}

          {showProgress && progressData && progressData.activeSessions.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Active Quiz Sessions</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {progressData.activeSessions.map((session, idx) => (
                      <tr key={idx} className={session.isPaused ? 'bg-yellow-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                          {session.sessionId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.participantName || 'Anonymous'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {KNOWLEDGE_LEVELS[session.knowledgeLevel - 1]} (Q{session.questionnaireId})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-3">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${session.progress}%` }}
                              ></div>
                            </div>
                            <span className="text-xs">
                              {session.currentQuestion}/{session.totalQuestions} ({session.progress}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            session.accuracy >= 70 ? 'bg-green-100 text-green-800' :
                            session.accuracy >= 50 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {session.accuracy}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            session.isPaused ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {session.isPaused ? '⏸️ Paused' : '▶️ Active'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div>
                            <div>{session.timeElapsed}m elapsed</div>
                            <div className="text-xs">
                              Last: {new Date(session.lastActivity).toLocaleTimeString()}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {showProgress && progressData && progressData.activeSessions.length === 0 && (
            <div className="bg-white p-8 rounded-lg shadow text-center">
              <div className="text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2h12a2 2 0 002-2v-5m0 0H4m16 0l-2-2m0 0l-2 2m2-2v2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No Active Sessions</h3>
                <p className="mt-1 text-sm text-gray-500">No users are currently taking quizzes</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Knowledge Level Performance */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Performance by Knowledge Level</h3>
            <div className="space-y-4">
              {Object.entries(data.summary.levelDistribution).map(([level, stats]) => {
                const levelName = KNOWLEDGE_LEVELS[parseInt(level) - 1];
                const accuracy = stats.avgAccuracy;
                return (
                  <div key={level} className="border-b pb-3 last:border-b-0">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{levelName} (Level {level})</span>
                      <span className="text-sm text-gray-600">{stats.count} participants</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${accuracy}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">{accuracy.toFixed(1)}% average accuracy</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type Accuracy */}
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Type Accuracy</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {Object.entries(data.typeAccuracy)
                .sort(([,a], [,b]) => b.accuracy - a.accuracy)
                .map(([type, stats]) => (
                <div key={type} className="flex items-center justify-between p-2 rounded bg-gray-50">
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded mr-3"
                      style={{ backgroundColor: TYPE_COLORS[type] || '#666' }}
                    ></div>
                    <span className="font-medium capitalize">{type}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">{stats.accuracy.toFixed(1)}%</span>
                    <span className="text-gray-500 ml-2">
                      ({stats.correctAnswers}/{stats.totalQuestions})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Results */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Quiz Results</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quiz
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accuracy
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recentResults.slice(0, 10).map((result) => (
                  <tr key={result.sessionId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(result.completedAt).toLocaleDateString()} {new Date(result.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.participantName || 'Anonymous'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {KNOWLEDGE_LEVELS[result.knowledgeLevel - 1]}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      Quiz {result.questionnaireId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {result.correctAnswers}/{result.totalQuestions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        result.overallAccuracy >= 80 ? 'bg-green-100 text-green-800' :
                        result.overallAccuracy >= 60 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {result.overallAccuracy.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Database Cleanup Section */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">🗑️ Database Cleanup</h3>
          
          {cleanupResult && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="text-lg font-semibold text-green-900 mb-2">✅ Cleanup Completed</h4>
              <div className="text-sm text-green-800 space-y-1">
                <p><strong>Total items deleted:</strong> {cleanupResult.details.total}</p>
                {cleanupResult.details.answers && (
                  <p><strong>Quiz answers:</strong> {cleanupResult.details.answers}</p>
                )}
                {cleanupResult.details.results && (
                  <p><strong>Quiz results:</strong> {cleanupResult.details.results}</p>
                )}
                {cleanupResult.details.participations && (
                  <p><strong>User participations:</strong> {cleanupResult.details.participations}</p>
                )}
                {cleanupResult.details.cutoffDate && (
                  <p><strong>Cutoff date:</strong> {new Date(cleanupResult.details.cutoffDate).toLocaleString()}</p>
                )}
                <p><strong>Completed at:</strong> {new Date(cleanupResult.timestamp).toLocaleString()}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cleanup Options */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Cleanup Options</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="old"
                    checked={cleanupType === 'old'}
                    onChange={(e) => setCleanupType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Delete old data (specify days)</span>
                </label>
                
                {cleanupType === 'old' && (
                  <div className="ml-6">
                    <label className="block text-sm text-gray-600 mb-1">Days old:</label>
                    <input
                      type="number"
                      value={daysOld}
                      onChange={(e) => setDaysOld(e.target.value)}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      min="1"
                      max="365"
                    />
                    <span className="ml-2 text-xs text-gray-500">
                      (Delete data older than {daysOld} days)
                    </span>
                  </div>
                )}

                <label className="flex items-center">
                  <input
                    type="radio"
                    value="incomplete"
                    checked={cleanupType === 'incomplete'}
                    onChange={(e) => setCleanupType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Delete incomplete sessions</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="radio"
                    value="stale"
                    checked={cleanupType === 'stale'}
                    onChange={(e) => setCleanupType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Delete stale sessions (inactive for 24+ hours)</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="radio"
                    value="all"
                    checked={cleanupType === 'all'}
                    onChange={(e) => setCleanupType(e.target.value)}
                    className="mr-2"
                  />
                  <span className="text-sm text-red-700 font-semibold">⚠️ Delete ALL data (DANGEROUS)</span>
                </label>
              </div>
            </div>

            {/* Cleanup Info */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Cleanup Information</h4>
              <div className="text-sm text-gray-600 space-y-2">
                {cleanupType === 'old' && (
                  <div className="p-3 bg-blue-50 rounded">
                    <p><strong>Old Data Cleanup:</strong></p>
                    <p>Will delete quiz answers, results, and user participations older than {daysOld} days.</p>
                  </div>
                )}
                {cleanupType === 'incomplete' && (
                  <div className="p-3 bg-yellow-50 rounded">
                    <p><strong>Incomplete Sessions:</strong></p>
                    <p>Will delete user participations that were never completed (partial progress).</p>
                  </div>
                )}
                {cleanupType === 'stale' && (
                  <div className="p-3 bg-orange-50 rounded">
                    <p><strong>Stale Sessions:</strong></p>
                    <p>Will delete incomplete sessions that have not been active for more than 24 hours.</p>
                  </div>
                )}
                {cleanupType === 'all' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded">
                    <p><strong>⚠️ COMPLETE WIPE:</strong></p>
                    <p>Will delete ALL quiz data including answers, results, and user participations. This action cannot be undone.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cleanup Actions */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setShowCleanupConfirm(true)}
              disabled={cleanupLoading || !authenticated}
              className={`px-4 py-2 rounded font-medium ${
                cleanupType === 'all' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              } disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {cleanupLoading ? 'Cleaning up...' : `Perform ${cleanupType.charAt(0).toUpperCase() + cleanupType.slice(1)} Cleanup`}
            </button>

            {data && (
              <div className="text-sm text-gray-500">
                Current data: {data.summary.totalParticipants} participants, {data.recentResults.length} recent results
              </div>
            )}
          </div>
        </div>

        {/* Confirmation Modal */}
        {showCleanupConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirm {cleanupType.charAt(0).toUpperCase() + cleanupType.slice(1)} Cleanup
              </h3>
              
              <div className="mb-6">
                {cleanupType === 'all' && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded mb-4">
                    <p className="text-red-800 font-semibold">⚠️ WARNING: This will delete ALL quiz data!</p>
                    <p className="text-red-700 text-sm mt-1">This action cannot be undone.</p>
                  </div>
                )}
                
                <p className="text-gray-700">
                  Are you sure you want to perform this cleanup? 
                  {cleanupType === 'old' && ` This will delete data older than ${daysOld} days.`}
                  {cleanupType === 'incomplete' && ' This will delete all incomplete sessions.'}
                  {cleanupType === 'stale' && ' This will delete sessions inactive for 24+ hours.'}
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowCleanupConfirm(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={performCleanup}
                  disabled={cleanupLoading}
                  className={`px-4 py-2 rounded text-white font-medium ${
                    cleanupType === 'all' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-orange-600 hover:bg-orange-700'
                  } disabled:bg-gray-400`}
                >
                  {cleanupLoading ? 'Cleaning...' : 'Confirm Cleanup'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Database Access Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🗄️ Database Access Information</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>MongoDB Connection:</strong> {process.env.MONGODB_URI || 'mongodb://localhost:27017/pokemon-quiz'}</p>
            <p><strong>Collections:</strong> userparticipations, quizanswers, quizresults, distributions</p>
            <p><strong>API Endpoint:</strong> <code>/api/quiz/results?key=YOUR_ADMIN_KEY</code></p>
            <p><strong>Auto-refresh:</strong> Every 30 seconds while dashboard is open</p>
          </div>
        </div>
      </div>
    </div>
  );
}