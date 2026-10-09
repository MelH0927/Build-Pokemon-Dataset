import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { QuizResult, Distribution } from '@/models/Quiz';
import { isValidAdminKey, adminAuthError } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('key');

    if (!isValidAdminKey(adminKey)) {
      return NextResponse.json(adminAuthError(), { status: 401 });
    }

    await connectDB();

    // Get all quiz results
    const results = await QuizResult.find({}).sort({ completedAt: -1 });

    // Get distribution data
    const distributions = await Distribution.find({}).sort({ date: -1 });

    // Calculate aggregate statistics
    const totalParticipants = results.length;
    const overallAccuracy = totalParticipants > 0 
      ? results.reduce((sum, result) => sum + result.overallAccuracy, 0) / totalParticipants 
      : 0;

    // Group by knowledge level
    const levelStats: Record<number, { count: number; avgAccuracy: number; totalAccuracy: number }> = {
      1: { count: 0, avgAccuracy: 0, totalAccuracy: 0 },
      2: { count: 0, avgAccuracy: 0, totalAccuracy: 0 },
      3: { count: 0, avgAccuracy: 0, totalAccuracy: 0 }
    };

    results.forEach(result => {
      const level = result.knowledgeLevel as keyof typeof levelStats;
      levelStats[level].count += 1;
      levelStats[level].totalAccuracy += result.overallAccuracy;
    });

    // Calculate averages
    Object.keys(levelStats).forEach((levelKey) => {
      const level = parseInt(levelKey) as keyof typeof levelStats;
      const stats = levelStats[level];
      stats.avgAccuracy = stats.count > 0 ? stats.totalAccuracy / stats.count : 0;
    });

    // Aggregate type accuracy across all results
    const globalTypeStats = new Map<string, { correct: number; total: number }>();
    
    results.forEach(result => {
      if (result.typeAccuracy) {
        result.typeAccuracy.forEach((typeData: { correct: number; total: number }, typeName: string) => {
          if (!globalTypeStats.has(typeName)) {
            globalTypeStats.set(typeName, { correct: 0, total: 0 });
          }
          const global = globalTypeStats.get(typeName)!;
          global.correct += typeData.correct;
          global.total += typeData.total;
        });
      }
    });

    // Calculate global type accuracies
    const globalTypeAccuracy: Record<string, { accuracy: number; totalQuestions: number; correctAnswers: number }> = {};
    globalTypeStats.forEach((data, typeName) => {
      globalTypeAccuracy[typeName] = {
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
        totalQuestions: data.total,
        correctAnswers: data.correct
      };
    });

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentResults = results.filter(result => result.completedAt >= sevenDaysAgo);

    return NextResponse.json({
      summary: {
        totalParticipants,
        overallAccuracy: Math.round(overallAccuracy * 100) / 100,
        levelDistribution: levelStats,
        recentParticipants: recentResults.length
      },
      typeAccuracy: globalTypeAccuracy,
      distributions: distributions.slice(0, 30), // Last 30 days
      recentResults: results.slice(0, 50).map(r => ({
        sessionId: r.sessionId,
        participantName: r.participantName || undefined,
        knowledgeLevel: r.knowledgeLevel,
        questionnaireId: r.questionnaireId,
        overallAccuracy: r.overallAccuracy,
        totalQuestions: r.totalQuestions,
        correctAnswers: r.correctAnswers,
        completedAt: r.completedAt
      })),
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    );
  }
}