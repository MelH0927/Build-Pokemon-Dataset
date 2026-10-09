import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { UserParticipation } from '@/models/Quiz';
import { isValidAdminKey, adminAuthError } from '@/lib/adminAuth';

// Update partial progress for a quiz session
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { sessionId, currentQuestionIndex, correctAnswers, isPaused } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Update the user participation with current progress
    const updated = await UserParticipation.findOneAndUpdate(
      { sessionId },
      {
        currentQuestionIndex: currentQuestionIndex || 0,
        correctAnswers: correctAnswers || 0,
        lastActivity: new Date(),
        isPaused: isPaused || false
      },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      progress: {
        sessionId: updated.sessionId,
        currentQuestionIndex: updated.currentQuestionIndex,
        totalQuestions: updated.totalQuestions,
        correctAnswers: updated.correctAnswers,
        lastActivity: updated.lastActivity,
        isPaused: updated.isPaused
      }
    });

  } catch (error) {
    console.error('Progress update error:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}

// Get live progress data for admin dashboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('key');

    // Simple admin key check
    if (!isValidAdminKey(adminKey)) {
      return NextResponse.json(adminAuthError(), { status: 401 });
    }

    await connectDB();

    // Get all active (incomplete) sessions from the last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const activeSessions = await UserParticipation.find({
      completed: false,
      startTime: { $gte: yesterday }
    }).sort({ lastActivity: -1 });

    // Format the data for the admin dashboard
    const progressData = activeSessions.map(session => ({
      sessionId: session.sessionId.substring(0, 8) + '...', // Show only first 8 chars for privacy
      participantName: session.participantName || undefined,
      knowledgeLevel: session.knowledgeLevel,
      questionnaireId: session.questionnaireId,
      progress: session.totalQuestions > 0 ? 
        Math.round((session.currentQuestionIndex / session.totalQuestions) * 100) : 0,
      currentQuestion: session.currentQuestionIndex + 1,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      accuracy: session.currentQuestionIndex > 0 ? 
        Math.round((session.correctAnswers / session.currentQuestionIndex) * 100) : 0,
      startTime: session.startTime,
      lastActivity: session.lastActivity,
      isPaused: session.isPaused,
      timeElapsed: Math.round((new Date().getTime() - session.startTime.getTime()) / 1000 / 60) // minutes
    }));

    return NextResponse.json({
      activeSessions: progressData,
      totalActive: progressData.length,
      paused: progressData.filter(s => s.isPaused).length,
      active: progressData.filter(s => !s.isPaused).length,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Progress fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch progress data' }, { status: 500 });
  }
}