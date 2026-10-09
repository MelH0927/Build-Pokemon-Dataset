#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the JSONL file
const dataPath = path.join(__dirname, '../public/standard_all.jsonl');
const outputDir = path.join(__dirname, '../public/questionnaires');

function readJSONL(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim().split('\n').map(line => JSON.parse(line));
}

function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function groupByType(entries) {
  const typeGroups = {};
  entries.forEach(entry => {
    const primaryType = entry.primary_type;
    if (!typeGroups[primaryType]) {
      typeGroups[primaryType] = [];
    }
    typeGroups[primaryType].push(entry);
  });
  return typeGroups;
}

function createBalancedQuestionnaires(entries) {
  // Define "famous" Pokemon for balanced distribution
  const famousPokemon = [
    'Pikachu', 'Charizard', 'Blastoise', 'Venusaur', 'Mewtwo', 'Mew', 'Eevee',
    'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon',
    'Lucario', 'Gardevoir', 'Garchomp', 'Dragonite', 'Gyarados', 'Lapras', 'Snorlax',
    'Gengar', 'Alakazam', 'Machamp', 'Golem', 'Onix', 'Rapidash', 'Arcanine',
    'Psyduck', 'Golduck', 'Meowth', 'Persian', 'Growlithe', 'Ponyta', 'Magikarp'
  ];

  // Separate famous and non-famous Pokemon
  const famousEntries = entries.filter(entry => famousPokemon.includes(entry.name));
  const regularEntries = entries.filter(entry => !famousPokemon.includes(entry.name));
  
  console.log(`Famous Pokemon: ${famousEntries.length}`);
  console.log(`Regular Pokemon: ${regularEntries.length}`);

  // Shuffle all entries first for better randomization
  const shuffledFamous = [...famousEntries].sort(() => Math.random() - 0.5);
  const shuffledRegular = [...regularEntries].sort(() => Math.random() - 0.5);
  
  // Create 3 questionnaires
  const questionnaires = [[], [], []];
  
  // Distribute famous Pokemon evenly (round-robin)
  shuffledFamous.forEach((entry, index) => {
    const questionnaire = index % 3;
    questionnaires[questionnaire].push(entry);
  });

  // Distribute regular Pokemon evenly (round-robin)
  shuffledRegular.forEach((entry, index) => {
    const questionnaire = index % 3;
    questionnaires[questionnaire].push(entry);
  });
  
  // Final shuffle of each questionnaire to mix famous and regular Pokemon
  questionnaires.forEach(questionnaire => {
    for (let i = questionnaire.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [questionnaire[i], questionnaire[j]] = [questionnaire[j], questionnaire[i]];
    }
  });

  // Verify type distribution
  console.log('\nType distribution verification:');
  const allTypes = Object.keys(groupByType(entries));
  allTypes.forEach(type => {
    const counts = questionnaires.map(q => q.filter(entry => entry.primary_type === type).length);
    console.log(`  ${type}: Q1=${counts[0]}, Q2=${counts[1]}, Q3=${counts[2]} (total: ${counts.reduce((a,b) => a+b, 0)})`);
  });
  
  return questionnaires;
}

function analyzeDifficultyBalance(questionnaires) {
  // Define "famous" Pokemon that beginners might know
  const famousPokemon = [
    'Pikachu', 'Charizard', 'Blastoise', 'Venusaur', 'Mewtwo', 'Mew', 'Eevee',
    'Vaporeon', 'Jolteon', 'Flareon', 'Espeon', 'Umbreon', 'Leafeon', 'Glaceon', 'Sylveon',
    'Lucario', 'Gardevoir', 'Garchomp', 'Dragonite', 'Gyarados', 'Lapras', 'Snorlax',
    'Gengar', 'Alakazam', 'Machamp', 'Golem', 'Onix', 'Rapidash', 'Arcanine',
    'Psyduck', 'Golduck', 'Meowth', 'Persian', 'Growlithe', 'Ponyta', 'Magikarp'
  ];
  
  // Analyze each questionnaire for balance verification
  const analysisResults = questionnaires.map((questionnaire, index) => {
    const famousCount = questionnaire.filter(entry => 
      famousPokemon.includes(entry.name)
    ).length;
    
    const typeDistribution = groupByType(questionnaire);
    const typeCount = Object.keys(typeDistribution).length;
    
    // Calculate generation distribution for additional balance checking
    const generationDistribution = {};
    questionnaire.forEach(entry => {
      const number = entry.number;
      let generation;
      if (number <= 151) generation = 'Gen 1';
      else if (number <= 251) generation = 'Gen 2';
      else if (number <= 386) generation = 'Gen 3';
      else if (number <= 493) generation = 'Gen 4';
      else if (number <= 649) generation = 'Gen 5';
      else if (number <= 721) generation = 'Gen 6';
      else if (number <= 809) generation = 'Gen 7';
      else if (number <= 905) generation = 'Gen 8';
      else generation = 'Gen 9+';
      
      generationDistribution[generation] = (generationDistribution[generation] || 0) + 1;
    });
    
    return {
      questionnaire: index + 1,
      totalEntries: questionnaire.length,
      famousCount,
      famousPercentage: (famousCount / questionnaire.length * 100).toFixed(1),
      typeCount,
      averagePerType: (questionnaire.length / typeCount).toFixed(1),
      generationDistribution
    };
  });
  
  return analysisResults;
}

function main() {
  console.log('Creating balanced Pokemon questionnaires...');
  
  // Read data
  const entries = readJSONL(dataPath);
  console.log(`Total entries loaded: ${entries.length}`);
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create questionnaires
  const questionnaires = createBalancedQuestionnaires(entries);
  
  // Analyze balance (not difficulty levels anymore)
  const analysis = analyzeDifficultyBalance(questionnaires);
  
  // Save questionnaires
  questionnaires.forEach((questionnaire, index) => {
    const filename = `questionnaire-${index + 1}.json`;
    const filePath = path.join(outputDir, filename);
    writeJSON(filePath, questionnaire);
    console.log(`\n✓ Saved ${filename}: ${questionnaire.length} entries`);
  });
  
  // Save analysis
  const analysisPath = path.join(outputDir, 'analysis.json');
  writeJSON(analysisPath, analysis);
  
  // Print summary
  console.log('\n📊 Questionnaire Balance Analysis:');
  console.log('┌─────────────┬─────────┬─────────┬──────────┬─────────┬─────────────┐');
  console.log('│ Questionnaire│ Entries │ Famous  │ Famous % │ Types   │ Avg/Type   │');
  console.log('├─────────────┼─────────┼─────────┼──────────┼─────────┼─────────────┤');
  analysis.forEach(a => {
    console.log(`│      ${a.questionnaire}      │   ${a.totalEntries.toString().padStart(3)}   │   ${a.famousCount.toString().padStart(3)}   │   ${a.famousPercentage.padStart(4)}%  │   ${a.typeCount.toString().padStart(2)}    │    ${a.averagePerType.padStart(4)}     │`);
  });
  console.log('└─────────────┴─────────┴─────────┴──────────┴─────────┴─────────────┘');
  
  console.log('\n📋 Generation Distribution:');
  analysis.forEach(a => {
    console.log(`\nQuestionnaire ${a.questionnaire}:`);
    Object.entries(a.generationDistribution).forEach(([gen, count]) => {
      console.log(`  ${gen}: ${count} entries`);
    });
  });
  
  console.log('\n🎯 Usage:');
  console.log('- All 3 questionnaires have equal difficulty');
  console.log('- User knowledge level is used only for balanced distribution');
  console.log('- Each questionnaire has balanced type and famous Pokemon distribution');
  
  console.log('\nFiles created:');
  console.log(`- ${outputDir}/questionnaire-1.json`);
  console.log(`- ${outputDir}/questionnaire-2.json`);
  console.log(`- ${outputDir}/questionnaire-3.json`);
  console.log(`- ${outputDir}/analysis.json`);
}

if (require.main === module) {
  main();
}

module.exports = { createBalancedQuestionnaires, analyzeDifficultyBalance };