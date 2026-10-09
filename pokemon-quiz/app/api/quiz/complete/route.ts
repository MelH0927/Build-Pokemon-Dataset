import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { UserParticipation, QuizAnswer, QuizResult } from '@/models/Quiz';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get user participation info
    const participation = await UserParticipation.findOne({ sessionId });
    if (!participation) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get all answers for this session
    const answers = await QuizAnswer.find({ sessionId });
    
    if (answers.length === 0) {
      return NextResponse.json(
        { error: 'No answers found for this session' },
        { status: 404 }
      );
    }

    // Calculate overall statistics
    const totalQuestions = answers.length;
    const correctAnswers = answers.filter(answer => answer.isCorrect).length;
    const overallAccuracy = (correctAnswers / totalQuestions) * 100;
    const averageResponseTime = answers.reduce((sum, answer) => sum + answer.responseTime, 0) / totalQuestions;

    // Calculate type-specific accuracy
    const typeStats = new Map();
    
    answers.forEach(answer => {
      const type = answer.actualPrimaryType;
      if (!typeStats.has(type)) {
        typeStats.set(type, { correct: 0, total: 0, accuracy: 0 });
      }
      
      const stats = typeStats.get(type);
      stats.total += 1;
      if (answer.isCorrect) {
        stats.correct += 1;
      }
      stats.accuracy = (stats.correct / stats.total) * 100;
    });

    // Save results
    const result = new QuizResult({
      sessionId,
      participantName: participation.participantName,
      knowledgeLevel: participation.knowledgeLevel,
      questionnaireId: participation.questionnaireId,
      overallAccuracy,
      totalQuestions,
      correctAnswers,
      typeAccuracy: typeStats,
      averageResponseTime
    });

    await result.save();

    // Update participation as completed
    participation.completed = true;
    participation.endTime = new Date();
    await participation.save();

    // Convert Map to Object for JSON response
    const typeAccuracyObj = Object.fromEntries(typeStats);

    return NextResponse.json({
      sessionId,
      participantName: participation.participantName || null,
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      correctAnswers,
      totalQuestions,
      typeAccuracy: typeAccuracyObj,
      averageResponseTime: Math.round(averageResponseTime),
      knowledgeLevel: participation.knowledgeLevel,
      questionnaireId: participation.questionnaireId
    });

  } catch (error) {
    console.error('Error completing quiz:', error);
    return NextResponse.json(
      { error: 'Failed to complete quiz' },
      { status: 500 }
    );
  }
}