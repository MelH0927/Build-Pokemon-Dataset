'use client';

import React, { useEffect, useState } from 'react';

/**
 * Enhanced Pokemon Type Quiz with Knowledge Level Selection
 * Features:
 * - Knowledge level selection (3 levels)
 * - Automatic questionnaire assignment
 * - Results tracking with type-specific accuracy
 * - Database integration for analytics
 */

/** ========================
 *  🔧 Configuration
 *  ======================== */
// Use full questionnaire (341-342 questions per quiz)
const KNOWLEDGE_LEVELS = [
  {
    id: 1,
    title: "Beginner",
    description: "Only heard of the famous ones (Pikachu, Eevee...)",
    icon: "🌱"
  },
  {
    id: 2,
    title: "Intermediate", 
    description: "Able to distinguish different types of Pokémon",
    icon: "⚡"
  },
  {
    id: 3,
    title: "Expert",
    description: "Familiar with Pokémon and have finished one or many Pokémon game(s)",
    icon: "🏆"
  }
];

/** ========================
 *  🎨 Type Colors
 *  ======================== */
const TYPE_COLORS: Record<string, string> = {
  normal: '#A8A77A',
  fire: '#EE8130',
  water: '#6390F0',
  electric: '#F7D02C',
  grass: '#7AC74C',
  ice: '#96D9D6',
  fighting: '#C22E28',
  poison: '#A33EA1',
  ground: '#E2BF65',
  flying: '#A98FF3',
  psychic: '#F95587',
  bug: '#A6B91A',
  rock: '#B6A136',
  ghost: '#735797',
  dragon: '#6F35FC',
  dark: '#705746',
  steel: '#B7B7CE',
  fairy: '#D685AD',
};

const ALL_TYPES = Object.keys(TYPE_COLORS) as (keyof typeof TYPE_COLORS)[];

const TYPE_LABELS: Record<string, string> = {
  normal: 'Normal', fire: 'Fire', water: 'Water', electric: 'Electric', grass: 'Grass', ice: 'Ice',
  fighting: 'Fighting', poison: 'Poison', ground: 'Ground', flying: 'Flying', psychic: 'Psychic', bug: 'Bug',
  rock: 'Rock', ghost: 'Ghost', dragon: 'Dragon', dark: 'Dark', steel: 'Steel', fairy: 'Fairy',
};

const TYPE_ABBR: Record<string, string> = {
  normal: '一般', fire: '火', water: '水', electric: '電', grass: '草', ice: '冰',
  fighting: '格鬥', poison: '毒', ground: '地面', flying: '飛行', psychic: '超能力', bug: '昆蟲',
  rock: '岩石', ghost: '幽靈', dragon: '龍', dark: '惡', steel: '鋼', fairy: '妖精',
};

/** Dataset entry shape */
type Entry = {
  image: string;
  primary_type: string;
  secondary_type?: string | null;
  art_style: string;
  name: string;
  paradox_or_ultrabeast?: string;
};

type QuizState = 'level-selection' | 'loading' | 'quiz' | 'results';

type QuizAnswer = {
  pokemon: Entry;
  userAnswer: string[];  // Changed to array for multiple selections
  isCorrect: boolean;
  responseTime: number;
};

type QuizResults = {
  overallAccuracy: number;
  correctAnswers: number;
  totalQuestions: number;
  questionnaireId: number;
  knowledgeLevel: number;
  typeAccuracy?: Record<string, { correct: number; total: number; percentage: number }>;
};

type SavedProgress = {
  quizState: QuizState;
  selectedLevel: number | null;
  sessionId: string;
  questionnaireId: number;
  entries: Entry[];
  currentIndex: number;
  answers: QuizAnswer[];
  selectedTypes: string[];
  startTime: number;
  timestamp: number;
  participantName?: string;
};

/** Progress saving helpers */
const STORAGE_KEY = 'pokemon-quiz-progress';

function saveProgress(progress: SavedProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

function loadProgress(): SavedProgress | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const progress = JSON.parse(saved) as SavedProgress;
    
    // Check if saved progress is less than 24 hours old
    const now = Date.now();
    const age = now - progress.timestamp;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (age > maxAge) {
      clearProgress();
      return null;
    }
    
    return progress;
  } catch (error) {
    console.error('Failed to load progress:', error);
    return null;
  }
}

function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear progress:', error);
  }
}

/** Normalize type strings */
function normType(t?: string | null): keyof typeof TYPE_COLORS | 'none' {
  if (!t) return 'none';
  const s = String(t).trim().toLowerCase();
  if (s === 'n/a' || s === 'null' || s === 'none' || s === '') return 'none';
  return (s as keyof typeof TYPE_COLORS) in TYPE_COLORS ? (s as keyof typeof TYPE_COLORS) : 'none';
}

function evaluateIsCorrect(
  userSel: string[],
  primary: string,
  secondary?: string | null
): boolean {
  const p = normType(primary);
  const s = normType(secondary);
  const picks = [...new Set(userSel.map(x => normType(x)).filter(t => t !== 'none'))];

  if (picks.length === 0) return false;

  // Single-type: must pick exactly 1, and it must match
  if (s === 'none') {
    if (picks.length > 1) return false;
    return picks.includes(p);
  }

  // Dual-type:
  // - If 1 pick: any correct type is OK
  if (picks.length === 1) {
    return picks.includes(p) || picks.includes(s);
  }

  // - If 2 picks: they must be exactly the two actual types
  if (picks.length === 2) {
    return picks.includes(p) && picks.includes(s);
  }

  // More than 2 never allowed by UI, but keep it safe:
  return false;
}


/** Load questionnaire data */
async function loadQuestionnaire(questionnaireId: number): Promise<Entry[]> {
  const response = await fetch(`/questionnaires/questionnaire-${questionnaireId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load questionnaire ${questionnaireId}`);
  }
  return response.json();
}

/** Quiz API calls */
async function startQuiz(knowledgeLevel: number, participantName?: string) {
  const response = await fetch('/api/quiz/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ knowledgeLevel, participantName: participantName?.trim() || undefined })
  });
  if (!response.ok) throw new Error('Failed to start quiz');
  return response.json();
}

async function submitAnswer(data: {
  sessionId: string;
  pokemonName: string;
  pokemonNumber: number;
  actualPrimaryType: string;
  actualSecondaryType: string | null;
  userAnswer: string[];  // Changed to array
  responseTime: number;
}) {
  const response = await fetch('/api/quiz/answer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Failed to submit answer');
  return response.json();
}

async function completeQuiz(sessionId: string) {
  const response = await fetch('/api/quiz/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId })
  });
  if (!response.ok) throw new Error('Failed to complete quiz');
  return response.json();
}

async function updateProgress(data: {
  sessionId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  correctAnswers: number;
  isPaused?: boolean;
}) {
  try {
    const response = await fetch('/api/quiz/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update progress');
    return response.json();
  } catch (error) {
    console.error('Failed to update progress:', error);
  }
}

/** Load image with fallback */
function useImageWithAuth(imagePathOrUrl: string) {
  const [src, setSrc] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadImage = async () => {
      try {
        setError('');
        // For local images in public folder
        if (imagePathOrUrl.startsWith('/')) {
          setSrc(imagePathOrUrl);
          return;
        }
        // Fallback for any other format
        setSrc(imagePathOrUrl);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    loadImage();
  }, [imagePathOrUrl]);

  return { src, error } as const;
}

/** Type button component */
function TypeButton({ 
  type, 
  onClick, 
  disabled = false,
  selected = false
}: { 
  type: keyof typeof TYPE_COLORS; 
  onClick: () => void; 
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <button
      className={`
        px-3 py-2 rounded-lg border-2 font-medium text-sm transition-all duration-200
        ${disabled 
          ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-300 text-gray-500'
          : selected
          ? 'border-4 border-yellow-400 text-white shadow-lg scale-105'
          : 'hover:scale-105 active:scale-95 border-gray-300 text-white hover:border-white'
        }
      `}
      style={{
        backgroundColor: disabled ? undefined : TYPE_COLORS[type],
        borderColor: disabled ? undefined : selected ? '#fbbf24' : TYPE_COLORS[type]
      }}
      onClick={onClick}
      disabled={disabled}
      title={TYPE_LABELS[type]}
    >
      {TYPE_ABBR[type]}
    </button>
  );
}

/** Main Quiz Component */
export default function PokemonTypeQuiz() {
  const [participantName, setParticipantName] = useState<string>('');
  const [quizState, setQuizState] = useState<QuizState>('level-selection');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [questionnaireId, setQuestionnaireId] = useState<number>(1);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);  // New state for multiple selection
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [startTime, setStartTime] = useState<number>(0);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [hasSavedProgress, setHasSavedProgress] = useState(false);

  // Current Pokemon
  const currentPokemon = entries[currentIndex];
  const { src: imageSrc, error: imageError } = useImageWithAuth(currentPokemon?.image || '');

  // Quiz progress
  const progress = entries.length > 0 ? ((currentIndex + 1) / entries.length) * 100 : 0;

  /** Load saved progress on component mount */
  useEffect(() => {
    const saved = loadProgress();
    if (saved) {
      setHasSavedProgress(true);
    }
  }, []);

  /** Save progress whenever state changes */
  useEffect(() => {
    if (quizState === 'quiz' && sessionId && entries.length > 0) {
      const progressData: SavedProgress = {
        quizState,
        selectedLevel,
        sessionId,
        questionnaireId,
        entries,
        currentIndex,
        answers,
        selectedTypes,
        startTime,
        timestamp: Date.now(),
        participantName: participantName?.trim() || undefined
      };
      saveProgress(progressData);
    }
  }, [quizState, selectedLevel, sessionId, questionnaireId, entries, currentIndex, answers, selectedTypes, startTime, participantName]);

  /** Restore saved progress */
  const restoreSavedProgress = async () => {
    const saved = loadProgress();
    if (!saved) return;

    setQuizState(saved.quizState);
    setSelectedLevel(saved.selectedLevel);
    setSessionId(saved.sessionId);
    setQuestionnaireId(saved.questionnaireId);
    setEntries(saved.entries);
    setCurrentIndex(saved.currentIndex);
    setAnswers(saved.answers);
    setSelectedTypes(saved.selectedTypes);
    setStartTime(saved.startTime);
    if (saved.participantName) {
      setParticipantName(saved.participantName);
    }
    setHasSavedProgress(false);

    // Update progress to resume (unpause)
    if (saved.sessionId && saved.entries.length > 0) {
      const correctCount = saved.answers.filter(a => a.isCorrect).length;
      await updateProgress({
        sessionId: saved.sessionId,
        currentQuestionIndex: saved.currentIndex,
        totalQuestions: saved.entries.length,
        correctAnswers: correctCount,
        isPaused: false
      });
    }
  };

  /** Handle knowledge level selection */
  const handleLevelSelection = async (level: number) => {
    setSelectedLevel(level);
    setLoading(true);
    setError('');

    try {
      // Start quiz session
  const result = await startQuiz(level, participantName);
      setSessionId(result.sessionId);
      setQuestionnaireId(result.questionnaireId);

      // Load questionnaire data
      const questionnaireData = await loadQuestionnaire(result.questionnaireId);
      
      // Shuffle and limit entries
      // Use the full questionnaire data (no limiting)
      const shuffled = [...questionnaireData].sort(() => Math.random() - 0.5);
      
      setEntries(shuffled);
      setCurrentIndex(0);
      setAnswers([]);
      setSelectedTypes([]); // Reset selected types
      setStartTime(Date.now());
      setQuizState('quiz');

      // Update initial progress
      await updateProgress({
        sessionId: result.sessionId,
        currentQuestionIndex: 0,
        totalQuestions: shuffled.length,
        correctAnswers: 0
      });

    } catch (err) {
      setError('Failed to start quiz. Please try again.');
      console.error('Quiz start error:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Handle type selection (toggle selection) */
  const handleTypeSelection = (selectedType: keyof typeof TYPE_COLORS) => {
    if (loading) return;
    
    setSelectedTypes(prev => {
      if (prev.includes(selectedType)) {
        // Remove if already selected
        return prev.filter(t => t !== selectedType);
      } else if (prev.length < 2) {
        // Add if less than 2 selected
        return [...prev, selectedType];
      } else {
        // Replace the first selection if already 2 selected
        return [prev[1], selectedType];
      }
    });
  };

  /** Handle manual submission of selected types */
  const handleSubmitAnswer = async () => {
    if (!currentPokemon || loading || selectedTypes.length === 0) return;

    setLoading(true);
    const responseTime = Date.now() - startTime;
    
    // Check if any selected type matches any actual type
    const isCorrect = evaluateIsCorrect(
      selectedTypes,
      currentPokemon.primary_type,
      currentPokemon.secondary_type
    );


    // Store answer locally
    const answer: QuizAnswer = {
      pokemon: currentPokemon,
      userAnswer: selectedTypes,
      isCorrect,
      responseTime
    };
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    // Submit to API
    try {
      // Extract Pokemon number from image filename (e.g., "tranquill-519.png" -> 519)
      const numberMatch = currentPokemon.image.match(/-(\d+)\.png$/);
      const pokemonNumber = numberMatch ? parseInt(numberMatch[1]) : 0;
      
      await submitAnswer({
        sessionId,
        pokemonName: currentPokemon.name,
        pokemonNumber: pokemonNumber,
        actualPrimaryType: currentPokemon.primary_type,
        actualSecondaryType: currentPokemon.secondary_type || null,
        userAnswer: selectedTypes,
        responseTime
      });
    } catch (err) {
      console.error('Failed to submit answer:', err);
    }

    // Move to next question or complete quiz
    if (currentIndex + 1 >= entries.length) {
      // Quiz complete
      try {
        const results = await completeQuiz(sessionId);
        setQuizResults(results);
        setQuizState('results');
        clearProgress(); // Clear saved progress when quiz is completed
      } catch (err) {
        console.error('Failed to complete quiz:', err);
        setError('Failed to save results');
      }
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedTypes([]); // Reset selections for next question
      setStartTime(Date.now());
      
      // Update progress after moving to next question
      const correctCount = newAnswers.filter(a => a.isCorrect).length;
      await updateProgress({
        sessionId,
        currentQuestionIndex: currentIndex + 1,
        totalQuestions: entries.length,
        correctAnswers: correctCount
      });
    }
    
    setLoading(false);
  };

  /** Restart quiz */
  const restartQuiz = () => {
    clearProgress(); // Clear saved progress
    setQuizState('level-selection');
    setSelectedLevel(null);
    setSessionId('');
    setEntries([]);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedTypes([]); // Reset selected types
    setQuizResults(null);
    setError('');
    setHasSavedProgress(false);
  };

  /** Render knowledge level selection */
  if (quizState === 'level-selection') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🎮 Pokémon Type Quiz
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              Test your knowledge of Pokémon types! Enter your name and select your experience level:
            </p>
          </div>

          {/* Quiz Rules Section */}
          <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-blue-900 mb-2">
                📋 How Scoring Works
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6 text-left">
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
                  <span className="mr-2">🔥</span>
                  Single-Type Pokémon
                </h3>
                <div className="space-y-2 text-gray-700">
                  <p className="font-medium">Rule: Choose the exact type to be correct</p>
                  <div className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                    <p className="text-sm"><strong>✅ Correct:</strong> Fire Pokémon → Choose &ldquo;Fire&rdquo;</p>
                  </div>
                  <div className="bg-red-50 p-2 rounded border-l-4 border-red-400">
                    <p className="text-sm"><strong>❌ Incorrect:</strong> Fire Pokémon → Choose &ldquo;Fire + Flying&rdquo;</p>
                    <p className="text-xs text-gray-600 mt-1">Extra guesses make it wrong!</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded-lg border border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 mb-3 flex items-center">
                  <span className="mr-2">🔥🪶</span>
                  Dual-Type Pokémon
                </h3>
                <div className="space-y-2 text-gray-700">
                  <p className="font-medium">Rule: Match any type OR both types exactly</p>
                  <div className="bg-green-50 p-2 rounded border-l-4 border-green-400">
                    <p className="text-sm"><strong>✅ Correct:</strong> Fire/Flying Pokémon → Choose &ldquo;Fire&rdquo; OR &ldquo;Flying&rdquo; OR &ldquo;Fire + Flying&rdquo;</p>
                  </div>
                  <div className="bg-red-50 p-2 rounded border-l-4 border-red-400">
                    <p className="text-sm"><strong>❌ Incorrect:</strong> Fire/Flying Pokémon → Choose &ldquo;Fire + Water&rdquo;</p>
                    <p className="text-xs text-gray-600 mt-1">If choosing 2 types, both must be correct!</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-center text-yellow-800 text-sm">
                💡 <strong>Tip:</strong> You can select 1 or 2 types per question. Click types to select/deselect them (we won&apos;t tell you if the pokemon is single or dual type!)
              </p>
            </div>
          </div>
          <div className="mb-8 flex flex-col items-center">
            <label htmlFor="participantName" className="text-lg font-medium text-gray-700 mb-2">Your Name</label>
            <input
              id="participantName"
              type="text"
              value={participantName}
              onChange={e => setParticipantName(e.target.value)}
              maxLength={80}
              className="w-64 px-4 py-2 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your name"
              disabled={loading}
            />
          </div>

          {/* Saved Progress Notification */}
          {hasSavedProgress && (
            <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="text-center">
                <h2 className="text-lg font-bold text-yellow-800 mb-2">
                  🔄 Continue Previous Quiz?
                </h2>
                <p className="text-yellow-700 mb-4">
                  You have a saved quiz in progress. Would you like to continue where you left off?
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    onClick={restoreSavedProgress}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    📱 Continue Quiz
                  </button>
                  <button
                    onClick={() => {
                      clearProgress();
                      setHasSavedProgress(false);
                    }}
                    disabled={loading}
                    className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
                  >
                    🔄 Start Fresh
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {KNOWLEDGE_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => handleLevelSelection(level.id)}
                disabled={loading}
                className={`
                  p-6 rounded-xl border-2 transition-all duration-200 text-left
                  ${loading 
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:scale-105 hover:shadow-lg border-gray-200 hover:border-blue-400'
                  }
                  bg-white
                `}
              >
                <div className="text-center mb-4">
                  <div className="text-4xl mb-2">{level.icon}</div>
                  <h3 className="text-xl font-bold text-gray-900">{level.title}</h3>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {level.description}
                </p>
              </button>
            ))}
          </div>

          {loading && (
            <div className="text-center mt-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Preparing your quiz...</p>
            </div>
          )}

          {error && (
            <div className="text-center mt-8">
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg max-w-md mx-auto">
                {error}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /** Render quiz */
  if (quizState === 'quiz') {
    if (!currentPokemon) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading Pokémon...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">Pokémon Type Quiz</h1>
                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                  💾 Auto-saved
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-600">
                  Level {selectedLevel} • Quiz {questionnaireId}
                </div>
                <button
                  onClick={async () => {
                    // Update progress with pause status
                    const correctCount = answers.filter(a => a.isCorrect).length;
                    await updateProgress({
                      sessionId,
                      currentQuestionIndex: currentIndex,
                      totalQuestions: entries.length,
                      correctAnswers: correctCount,
                      isPaused: true
                    });
                    
                    setQuizState('level-selection');
                    setHasSavedProgress(true); // Show continue option when pausing
                  }}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                >
                  ⏸️ Pause
                </button>
              </div>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">
              Question {currentIndex + 1} of {entries.length} • 
              {answers.length > 0 && (
                <span className="text-green-600">
                  {answers.filter(a => a.isCorrect).length}/{answers.length} correct so far
                </span>
              )}
            </p>
          </div>

          {/* Pokemon card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                What type is this Pokémon?
              </h2>
              
              <div className="relative inline-block">
                {imageSrc ? (
                  <img
                    src={imageSrc}
                    alt={currentPokemon.name}
                    className="w-48 h-48 object-contain mx-auto rounded-lg bg-gray-50"
                    onError={() => console.log('Image failed to load')}
                  />
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center mx-auto">
                    <span className="text-gray-500">Loading image...</span>
                  </div>
                )}
                {imageError && (
                  <div className="absolute inset-0 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500 text-sm">Image not available</span>
                  </div>
                )}
              </div>

              {/* Hidden Pokemon name for evaluation only - not displayed to user */}
            </div>

            {/* Type selection grid */}
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Select 1-2 types (click to select/deselect)
                </p>
                <p className="text-xs text-gray-500">
                  Selected: {selectedTypes.length}/2
                </p>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {ALL_TYPES.map((type) => (
                  <TypeButton
                    key={type}
                    type={type}
                    onClick={() => handleTypeSelection(type)}
                    disabled={loading}
                    selected={selectedTypes.includes(type)}
                  />
                ))}
              </div>
              
              {/* Submit button */}
              <div className="text-center pt-4">
                <button
                  onClick={handleSubmitAnswer}
                  disabled={loading || selectedTypes.length === 0}
                  className={`
                    px-6 py-3 rounded-lg font-medium text-white transition-all duration-200
                    ${selectedTypes.length === 0 || loading
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 hover:scale-105 active:scale-95'
                    }
                  `}
                >
                  {loading ? 'Submitting...' : `Submit Answer (${selectedTypes.length} type${selectedTypes.length !== 1 ? 's' : ''} selected)`}
                </button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="text-center text-sm text-gray-600">
            <p>Correct: {answers.filter(a => a.isCorrect).length} / {answers.length}</p>
            {answers.length > 0 && (
              <p>Accuracy: {Math.round((answers.filter(a => a.isCorrect).length / answers.length) * 100)}%</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /** Render results */
  if (quizState === 'results' && quizResults) {
    const typeAccuracyEntries = Object.entries(quizResults.typeAccuracy || {});
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              🎉 Quiz Complete!
            </h1>
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="grid md:grid-cols-2 gap-8">
                {/* Overall Stats */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Overall Results</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Accuracy:</span>
                      <span className="font-bold text-lg text-blue-600">
                        {quizResults.overallAccuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Correct Answers:</span>
                      <span className="font-semibold">
                        {quizResults.correctAnswers} / {quizResults.totalQuestions}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Knowledge Level:</span>
                      <span className="font-semibold">
                        {KNOWLEDGE_LEVELS.find(l => l.id === quizResults.knowledgeLevel)?.title}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Questionnaire:</span>
                      <span className="font-semibold">#{quizResults.questionnaireId}</span>
                    </div>
                  </div>
                </div>

                {/* Type-specific accuracy */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Type Accuracy</h2>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {typeAccuracyEntries.map(([type, stats]: [string, { correct: number; total: number; percentage: number }]) => (
                      <div key={type} className="flex items-center justify-between p-2 rounded bg-gray-50">
                        <div className="flex items-center">
                          <div
                            className="w-4 h-4 rounded mr-2"
                            style={{ backgroundColor: TYPE_COLORS[type as keyof typeof TYPE_COLORS] }}
                          ></div>
                          <span className="text-sm font-medium capitalize">{type}</span>
                        </div>
                        <div className="text-sm">
                          <span className="font-semibold">{stats.percentage.toFixed(0)}%</span>
                          <span className="text-gray-500 ml-1">
                            ({stats.correct}/{stats.total})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={restartQuiz}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Take Another Quiz
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}