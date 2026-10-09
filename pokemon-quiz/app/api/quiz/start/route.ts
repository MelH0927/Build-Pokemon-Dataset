import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { UserParticipation, Distribution } from '@/models/Quiz';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
  const { knowledgeLevel, participantName } = await request.json();
    
    if (!knowledgeLevel || knowledgeLevel < 1 || knowledgeLevel > 3) {
      return NextResponse.json(
        { error: 'Invalid knowledge level' },
        { status: 400 }
      );
    }

    // Generate unique session ID
    const sessionId = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);

    // Get today's date for distribution tracking
    const today = new Date().toISOString().split('T')[0];

    // Get or create today's distribution record
    let distribution = await Distribution.findOne({ date: today });
    if (!distribution) {
      distribution = new Distribution({ date: today });
    }

    // Update level counts
    const levelField = `level${knowledgeLevel}Count`;
    distribution[levelField] += 1;

    // Calculate questionnaire assignment based on current distribution
    const questionnaire1Assigned = distribution.questionnaire1Assigned;
    const questionnaire2Assigned = distribution.questionnaire2Assigned;
    const questionnaire3Assigned = distribution.questionnaire3Assigned;

    // Balance assignment - find questionnaire with lowest assignment for this level
    const assignments = [
      { id: 1, count: questionnaire1Assigned },
      { id: 2, count: questionnaire2Assigned },
      { id: 3, count: questionnaire3Assigned }
    ];

    // Sort by count to assign to least assigned questionnaire
    assignments.sort((a, b) => a.count - b.count);
    const assignedQuestionnaire = assignments[0].id;

    // Update questionnaire assignment count
    const questionnaireField = `questionnaire${assignedQuestionnaire}Assigned`;
    distribution[questionnaireField] += 1;

    await distribution.save();

    // Sanitise participant name (optional field)
    let cleanName: string | undefined = undefined;
    if (participantName && typeof participantName === 'string') {
      const trimmed = participantName.trim();
      if (trimmed.length > 0) {
        cleanName = trimmed.substring(0, 80);
      }
    }

    // Create user participation record
    const participation = new UserParticipation({
      sessionId,
      participantName: cleanName,
      knowledgeLevel,
      questionnaireId: assignedQuestionnaire,
      totalQuestions: 341 // Standard questionnaire size
    });

    await participation.save();

    return NextResponse.json({
      sessionId,
      questionnaireId: assignedQuestionnaire,
      participantName: cleanName,
      message: `Assigned to questionnaire ${assignedQuestionnaire} based on knowledge level ${knowledgeLevel}`
    });

  } catch (error) {
    console.error('Error starting quiz:', error);
    return NextResponse.json(
      { error: 'Failed to start quiz' },
      { status: 500 }
    );
  }
}