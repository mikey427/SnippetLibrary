// Simple test to demonstrate the snippet library functionality
console.log('🚀 Snippet Library Demo\n');

// Mock data to show what the library can do
const mockSnippets = [
  {
    id: '1',
    title: 'React Hook',
    description: 'Custom React hook for API calls',
    code: `const useApi = (url) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(url).then(res => res.json()).then(setData).finally(() => setLoading(false));
  }, [url]);
  
  return { data, loading };
};`,
    language: 'javascript',
    tags: ['react', 'hooks', 'api'],
    category: 'frontend',
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 5
  },
  {
    id: '2',
    title: 'Python List Comprehension',
    description: 'Filter and transform lists efficiently',
    code: `# Filter even numbers and square them
result = [x**2 for x in numbers if x % 2 == 0]

# Dictionary comprehension
word_lengths = {word: len(word) for word in words}`,
    language: 'python',
    tags: ['python', 'list-comprehension', 'functional'],
    category: 'algorithms',
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 2
  },
  {
    id: '3',
    title: 'CSS Flexbox Center',
    description: 'Center content with flexbox',
    code: `.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
}`,
    language: 'css',
    tags: ['css', 'flexbox', 'layout'],
    category: 'styling',
    createdAt: new Date(),
    updatedAt: new Date(),
    usageCount: 8
  }
];

console.log('📋 Sample Snippets in Library:');
console.log('================================\n');

mockSnippets.forEach((snippet, index) => {
  console.log(`${index + 1}. ${snippet.title}`);
  console.log(`   Language: ${snippet.language}`);
  console.log(`   Tags: ${snippet.tags.join(', ')}`);
  console.log(`   Usage: ${snippet.usageCount} times`);
  console.log(`   Description: ${snippet.description}`);
  console.log('   Code:');
  console.log('   ' + snippet.code.split('\n').join('\n   '));
  console.log('\n' + '─'.repeat(50) + '\n');
});

console.log('🔍 Search Examples:');
console.log('==================');

// Simulate search functionality
function simulateSearch(query, snippets) {
  const results = snippets.filter(s => {
    if (query.text) {
      const searchText = query.text.toLowerCase();
      return s.title.toLowerCase().includes(searchText) ||
             s.description.toLowerCase().includes(searchText) ||
             s.code.toLowerCase().includes(searchText) ||
             s.tags.some(tag => tag.toLowerCase().includes(searchText));
    }
    if (query.language) {
      return s.language === query.language;
    }
    if (query.tags) {
      return query.tags.every(tag => s.tags.includes(tag));
    }
    return true;
  });

  if (query.sortBy === 'usageCount') {
    results.sort((a, b) => query.sortOrder === 'desc' ? b.usageCount - a.usageCount : a.usageCount - b.usageCount);
  }

  return results;
}

// Example searches
const searches = [
  { text: 'react', description: 'Search for "react"' },
  { language: 'python', description: 'Filter by Python language' },
  { tags: ['css'], description: 'Filter by CSS tag' },
  { sortBy: 'usageCount', sortOrder: 'desc', description: 'Sort by most used' }
];

searches.forEach(search => {
  console.log(`\n🔎 ${search.description}:`);
  const results = simulateSearch(search, mockSnippets);
  if (results.length > 0) {
    results.forEach(r => console.log(`   ✓ ${r.title} (${r.language}) - Used ${r.usageCount} times`));
  } else {
    console.log('   No results found');
  }
});

console.log('\n📊 Statistics:');
console.log('==============');
console.log(`Total snippets: ${mockSnippets.length}`);
console.log(`Total usage: ${mockSnippets.reduce((sum, s) => sum + s.usageCount, 0)}`);
console.log(`Languages: ${[...new Set(mockSnippets.map(s => s.language))].join(', ')}`);
console.log(`Most used: ${mockSnippets.sort((a, b) => b.usageCount - a.usageCount)[0].title}`);

console.log('\n✅ This demonstrates the core functionality!');
console.log('📝 The actual library supports:');
console.log('   • File system storage (JSON/YAML)');
console.log('   • Real-time file watching');
console.log('   • Import/export with conflict resolution');
console.log('   • Advanced validation');
console.log('   • Error handling and recovery');
console.log('   • Backup and restore');
console.log('   • Usage analytics');
console.log('\n🎯 Next step: Build a user interface!');