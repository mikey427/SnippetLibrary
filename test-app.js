const { SnippetManagerImpl, createWorkspaceStorageService } = require('./out/core/services');

async function testSnippetLibrary() {
  console.log('🚀 Testing Snippet Library...\n');

  // Create storage service and snippet manager
  const storage = createWorkspaceStorageService('./test-snippets');
  const manager = new SnippetManagerImpl(storage);

  try {
    // Initialize
    console.log('📦 Initializing...');
    const initResult = await manager.initialize();
    if (!initResult.success) {
      console.error('❌ Failed to initialize:', initResult.error.message);
      return;
    }
    console.log('✅ Initialized successfully\n');

    // Create some test snippets
    console.log('📝 Creating test snippets...');
    
    const snippet1 = await manager.createSnippet({
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
      category: 'frontend'
    });

    const snippet2 = await manager.createSnippet({
      title: 'Python List Comprehension',
      description: 'Filter and transform lists efficiently',
      code: `# Filter even numbers and square them
result = [x**2 for x in numbers if x % 2 == 0]

# Dictionary comprehension
word_lengths = {word: len(word) for word in words}`,
      language: 'python',
      tags: ['python', 'list-comprehension', 'functional'],
      category: 'algorithms'
    });

    console.log(`✅ Created ${snippet1.success ? 1 : 0} + ${snippet2.success ? 1 : 0} snippets\n`);

    // Search snippets
    console.log('🔍 Searching snippets...');
    const searchResult = await manager.searchSnippets({ 
      text: 'react',
      sortBy: 'title',
      sortOrder: 'asc'
    });
    
    if (searchResult.success) {
      console.log(`Found ${searchResult.data.length} snippets matching "react":`);
      searchResult.data.forEach(s => console.log(`  - ${s.title} (${s.language})`));
    }
    console.log('');

    // Get all snippets
    console.log('📋 All snippets:');
    const allResult = await manager.getAllSnippets();
    if (allResult.success) {
      allResult.data.forEach(s => {
        console.log(`  📄 ${s.title}`);
        console.log(`     Language: ${s.language}`);
        console.log(`     Tags: ${s.tags.join(', ')}`);
        console.log(`     Usage: ${s.usageCount} times`);
        console.log('');
      });
    }

    // Test usage tracking
    if (snippet1.success) {
      console.log('📊 Testing usage tracking...');
      await manager.incrementUsage(snippet1.data.id);
      await manager.incrementUsage(snippet1.data.id);
      
      const stats = await manager.getUsageStatistics();
      if (stats.success) {
        console.log(`Total snippets: ${stats.data.totalSnippets}`);
        console.log(`Total usage: ${stats.data.totalUsage}`);
        console.log(`Most used: ${stats.data.mostUsedSnippets[0]?.snippet.title || 'None'}`);
      }
    }

    console.log('\n✅ Test completed successfully!');
    console.log('📁 Check ./test-snippets/ for saved files');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    manager.dispose();
  }
}

testSnippetLibrary().catch(console.error);