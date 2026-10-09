import mongoose from 'mongoose';

// User participation tracking
const UserParticipationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  participantName: { type: String, trim: true, maxlength: 80 },
  knowledgeLevel: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 3,
    enum: [1, 2, 3]
  },
  questionnaireId: { 
    type: Number, 
    required: true, 
    min: 1, 
    max: 3,
    enum: [1, 2, 3]
  },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  completed: { type: Boolean, default: false },
  // Partial progress tracking
  currentQuestionIndex: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  correctAnswers: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now },
  isPaused: { type: Boolean, default: false }
});

// Individual quiz answer
const QuizAnswerSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  pokemonName: { type: String, required: true },
  pokemonNumber: { type: Number, required: true },
  actualPrimaryType: { type: String, required: true },
  actualSecondaryType: { type: String, default: null },
  userAnswer: { type: mongoose.Schema.Types.Mixed, required: true }, // Can be string or array
  isCorrect: { type: Boolean, required: true },
  responseTime: { type: Number, required: true }, // milliseconds
  timestamp: { type: Date, default: Date.now }
});

// Quiz session results
const QuizResultSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  participantName: { type: String, trim: true, maxlength: 80 },
  knowledgeLevel: { type: Number, required: true },
  questionnaireId: { type: Number, required: true },
  overallAccuracy: { type: Number, required: true }, // percentage
  totalQuestions: { type: Number, required: true },
  correctAnswers: { type: Number, required: true },
  typeAccuracy: { 
    type: Map, 
    of: {
      correct: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      accuracy: { type: Number, default: 0 }
    }
  },
  averageResponseTime: { type: Number, required: true }, // milliseconds
  completedAt: { type: Date, default: Date.now }
});

// Distribution tracking for balanced assignment
const DistributionSchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD format
  level1Count: { type: Number, default: 0 },
  level2Count: { type: Number, default: 0 },
  level3Count: { type: Number, default: 0 },
  questionnaire1Assigned: { type: Number, default: 0 },
  questionnaire2Assigned: { type: Number, default: 0 },
  questionnaire3Assigned: { type: Number, default: 0 }
});

// Create models
export const UserParticipation = mongoose.models.UserParticipation || 
  mongoose.model('UserParticipation', UserParticipationSchema);

export const QuizAnswer = mongoose.models.QuizAnswer || 
  mongoose.model('QuizAnswer', QuizAnswerSchema);

export const QuizResult = mongoose.models.QuizResult || 
  mongoose.model('QuizResult', QuizResultSchema);

export const Distribution = mongoose.models.Distribution || 
  mongoose.model('Distribution', DistributionSchema);