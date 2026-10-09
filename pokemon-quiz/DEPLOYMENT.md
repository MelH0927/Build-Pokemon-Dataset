# Pokémon Type Quiz Deployment Guide

## 🚀 Vercel Deployment

### 1. Environment Variables
Set these in your Vercel dashboard:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pokemon-quiz
ADMIN_KEY=your-secure-admin-key-2024
```

### 2. MongoDB Setup
1. Create a free MongoDB Atlas account at https://www.mongodb.com/atlas
2. Create a new cluster
3. Create a database user with read/write permissions
4. Whitelist your IP address (or use 0.0.0.0/0 for all IPs)
5. Get your connection string and add it to MONGODB_URI

### 3. Deploy
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 📊 Accessing Results

### Admin Dashboard
- URL: `https://your-domain.vercel.app/admin`
- Admin key: the value of `ADMIN_KEY` (required; the server refuses to start without it)
- Features:
  - Real-time participant statistics
  - Type-specific accuracy analysis
  - Knowledge level performance
  - Recent quiz results
  - Auto-refresh every 30 seconds

### API Access
- Endpoint: `https://your-domain.vercel.app/api/quiz/results?key=YOUR_ADMIN_KEY`
- Returns JSON with all statistics
- Can be used for external analytics

## 🎯 Quiz Features

### Knowledge Levels
1. **Beginner**: Only heard of famous ones (Pikachu, Eevee...)
2. **Intermediate**: Able to distinguish different types of Pokémon  
3. **Expert**: Familiar with Pokémon and have finished one or many Pokémon game(s)

### Questionnaire Distribution
- 3 balanced questionnaires with equal difficulty
- ~341-342 entries each
- Equal famous Pokémon distribution (3.5% each)
- All 18 types represented equally
- Users automatically assigned based on participation balance

### Data Collected
- Overall accuracy per user
- Type-specific accuracy
- Response times
- Knowledge level performance
- Session tracking
- Daily participation statistics

## 📈 Analytics Available

### Summary Metrics
- Total participants
- Overall accuracy across all users
- Recent activity (last 7 days)
- Knowledge level distribution

### Detailed Analysis
- Performance by knowledge level
- Type accuracy rankings
- Individual quiz results
- Daily participation trends
- Questionnaire assignment balance

## 🔒 Security

- Admin dashboard protected by key authentication
- Environment variables for sensitive data
- Session-based tracking (no personal data stored)
- MongoDB connection encrypted

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your MongoDB URI and admin key

# Run development server
npm run dev
```

## 📱 Mobile Responsive

The quiz is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones
- Progressive Web App capable

## 🎨 Customization

- Type colors in `components/EnhancedPokemonQuiz.tsx`
- Famous Pokémon list in `scripts/create-questionnaires.js`
- Quiz parameters (MAX_ITEMS) in quiz component
- Admin key in environment variables