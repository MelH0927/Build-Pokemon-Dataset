'use client';

export default function SimplePokemonQuiz() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🎮 Pokémon Type Quiz
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Loading quiz... If this page is blank, there might be a JavaScript error.
          </p>
          <button 
            onClick={() => console.log('Button clicked')}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            Test Button
          </button>
        </div>
      </div>
    </div>
  );
}