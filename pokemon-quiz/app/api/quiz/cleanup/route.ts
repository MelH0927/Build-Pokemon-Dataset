import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { QuizAnswer, QuizResult, UserParticipation } from '@/models/Quiz';
import { isValidAdminKey, adminAuthError } from '@/lib/adminAuth';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminKey = searchParams.get('key');
    const cleanupType = searchParams.get('type');
    const daysOld = searchParams.get('daysOld');

    // Verify admin key
    if (!isValidAdminKey(adminKey)) {
      return NextResponse.json(adminAuthError(), { status: 401 });
    }

    await dbConnect();

    let deleteResult;
    const now = new Date();

    switch (cleanupType) {
      case 'all':
        // Delete all quiz data
        const allAnswers = await QuizAnswer.deleteMany({});
        const allResults = await QuizResult.deleteMany({});
        const allParticipations = await UserParticipation.deleteMany({});
        
        deleteResult = {
          answers: allAnswers.deletedCount,
          results: allResults.deletedCount,
          participations: allParticipations.deletedCount,
          total: allAnswers.deletedCount + allResults.deletedCount + allParticipations.deletedCount
        };
        break;

      case 'old':
        // Delete data older than specified days
        const days = parseInt(daysOld || '30');
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        
        const oldAnswers = await QuizAnswer.deleteMany({
          createdAt: { $lt: cutoffDate }
        });
        const oldResults = await QuizResult.deleteMany({
          completedAt: { $lt: cutoffDate }
        });
        const oldParticipations = await UserParticipation.deleteMany({
          createdAt: { $lt: cutoffDate }
        });
        
        deleteResult = {
          answers: oldAnswers.deletedCount,
          results: oldResults.deletedCount,
          participations: oldParticipations.deletedCount,
          total: oldAnswers.deletedCount + oldResults.deletedCount + oldParticipations.deletedCount,
          cutoffDate: cutoffDate.toISOString(),
          daysOld: days
        };
        break;

      case 'incomplete':
        // Delete incomplete/partial progress sessions
        const incompleteParticipations = await UserParticipation.deleteMany({
          isCompleted: { $ne: true }
        });
        
        deleteResult = {
          participations: incompleteParticipations.deletedCount,
          total: incompleteParticipations.deletedCount
        };
        break;

      case 'stale':
        // Delete sessions that haven't been active for more than 24 hours
        const staleDate = new Date(now.getTime() - (24 * 60 * 60 * 1000));
        
        const staleParticipations = await UserParticipation.deleteMany({
          lastActivity: { $lt: staleDate },
          isCompleted: { $ne: true }
        });
        
        deleteResult = {
          participations: staleParticipations.deletedCount,
          total: staleParticipations.deletedCount,
          staleDate: staleDate.toISOString()
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid cleanup type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Cleanup completed successfully`,
      details: deleteResult,
      timestamp: now.toISOString()
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Failed to perform cleanup' },
      { status: 500 }
    );
  }
}