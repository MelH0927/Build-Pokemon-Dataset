import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { QuizAnswer } from '@/models/Quiz';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const {
      sessionId,
      pokemonName,
      pokemonNumber,
      actualPrimaryType,
      actualSecondaryType,
      userAnswer,
      responseTime
    } = await request.json();

    if (!sessionId || !pokemonName || !actualPrimaryType || !userAnswer) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Determine if answer is correct - check if any user answer matches any actual type
    const actualTypes = [
      actualPrimaryType.toLowerCase(),
      actualSecondaryType?.toLowerCase()
    ].filter(Boolean);
    
    const userAnswers = Array.isArray(userAnswer) ? userAnswer : [userAnswer];
    const isCorrect = userAnswers.some(answer => 
      actualTypes.includes(answer.toLowerCase())
    );

    // Save the answer
    const answer = new QuizAnswer({
      sessionId,
      pokemonName,
      pokemonNumber,
      actualPrimaryType,
      actualSecondaryType: actualSecondaryType || null,
      userAnswer,
      isCorrect,
      responseTime: responseTime || 0
    });

    await answer.save();

    return NextResponse.json({
      isCorrect,
      correctAnswer: actualPrimaryType,
      message: isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${actualPrimaryType}.`
    });

  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Failed to submit answer' },
      { status: 500 }
    );
  }
}