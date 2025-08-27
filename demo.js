// Demo script to test Snippet Library functionality
const path = require('path');

// Import the compiled core services
const { SnippetManagerImpl } = require('./out/core/services/SnippetManagerImpl');
const { FileSystemStorageService } = require('./out/core/services/FileSystemStorageService');
const { SearchService } = require('./out/core/services/SearchService');
const { ImportExportService } = require('./out/core/services/ImportExportService');
const { ErrorHandler } = require('./out/core/errors/ErrorHandler');

async function demoSnippetLibrary() {
    console.log('🚀 Welcome to Snippet Library Demo!\n');
    
    try {
        // Initialize services
        console.log('📦 Initializing services...');
        const storageService = new FileSystemStorageService();
        const searchService = new SearchService();
        const importExportService = new ImportExportService();
        const errorHandler = new ErrorHandler();
        
        const snippetManager = new SnippetManagerImpl(
            storageService,
            searchService,
            importExportService,
            errorHandler
        );
        
        // Initialize the snippet manager
        console.log('🔧 Setting up snippet manager...');
        const initResult = await snippetManager.initialize();
        if (!initResult.success) {
            console.error('❌ Failed to initialize:', initResult.error.message);
            return;
        }
        console.log('✅ Snippet manager initialized successfully!\n');
        
        // Create some demo snippets
        console.log('📝 Creating demo snippets...');
        
        const snippet1 = {
            title: 'React useState Hook',
            description: 'Basic useState hook for managing component state',
            code: `const [count, setCount] = useState(0);

const increment = () => {
    setCount(count + 1);
};`,
            language: 'javascript',
            tags: ['react', 'hooks', 'state'],
            category: 'React Components'
        };
        
        const snippet2 = {
            title: 'Python List Comprehension',
            description: 'Filter and transform a list in one line',
            code: `# Filter even numbers and square them
result = [x**2 for x in numbers if x % 2 == 0]`,
            language: 'python',
            tags: ['python', 'list', 'comprehension'],
            category: 'Python Utilities'
        };
        
        const snippet3 = {
            title: 'CSS Flexbox Center',
            description: 'Center content both horizontally and vertically',
            code: `.container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
}`,
            language: 'css',
            tags: ['css', 'flexbox', 'center'],
            category: 'CSS Layouts'
        };
        
        // Save snippets
        const results = [];
        for (const snippet of [snippet1, snippet2, snippet3]) {
            const result = await snippetManager.createSnippet(snippet);
            if (result.success) {
                results.push(result.data);
                console.log(`✅ Created: "${snippet.title}"`);
            } else {
                console.log(`❌ Failed to create "${snippet.title}": ${result.error.message}`);
            }
        }
        
        console.log(`\n📊 Successfully created ${results.length} snippets!\n`);
        
        // Demonstrate search functionality
        console.log('🔍 Testing search functionality...');
        
        // Search by text
        const searchResult1 = await snippetManager.searchSnippets({
            text: 'react',
            caseSensitive: false
        });
        
        if (searchResult1.success) {
            console.log(`📋 Found ${searchResult1.data.length} snippets containing "react":`);
            searchResult1.data.forEach(snippet => {
                console.log(`   - ${snippet.title} (${snippet.language})`);
            });
        }
        
        // Search by language
        const searchResult2 = await snippetManager.searchSnippets({
            language: 'python'
        });
        
        if (searchResult2.success) {
            console.log(`\n🐍 Found ${searchResult2.data.length} Python snippets:`);
            searchResult2.data.forEach(snippet => {
                console.log(`   - ${snippet.title}`);
                console.log(`     Tags: ${snippet.tags.join(', ')}`);
            });
        }
        
        // Get all snippets
        console.log('\n📚 All snippets in your library:');
        const allSnippets = await snippetManager.getAllSnippets();
        if (allSnippets.success) {
            allSnippets.data.forEach((snippet, index) => {
                console.log(`\n${index + 1}. ${snippet.title}`);
                console.log(`   Language: ${snippet.language}`);
                console.log(`   Category: ${snippet.category}`);
                console.log(`   Tags: ${snippet.tags.join(', ')}`);
                console.log(`   Description: ${snippet.description}`);
                console.log(`   Code preview: ${snippet.code.substring(0, 50)}...`);
            });
        }
        
        // Demonstrate export functionality
        console.log('\n📤 Testing export functionality...');
        const exportResult = await snippetManager.exportSnippets();
        if (exportResult.success) {
            console.log(`✅ Successfully exported ${exportResult.data.snippets.length} snippets`);
            console.log(`📊 Export metadata:`, exportResult.data.metadata);
        }
        
        // Get usage statistics
        console.log('\n📈 Getting usage statistics...');
        const statsResult = await snippetManager.getUsageStats();
        if (statsResult.success) {
            console.log(`📊 Total snippets: ${statsResult.data.totalSnippets}`);
            console.log(`📊 Total usage: ${statsResult.data.totalUsage}`);
            console.log(`📊 Top used snippets: ${statsResult.data.topUsed.length}`);
        }
        
        console.log('\n🎉 Demo completed successfully!');
        console.log('\n💡 Next steps:');
        console.log('   1. Install this as a VS Code extension');
        console.log('   2. Use Ctrl+Shift+S to save snippets from your code');
        console.log('   3. Use Ctrl+Shift+I to insert snippets');
        console.log('   4. Open the Web GUI for advanced management');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the demo
demoSnippetLibrary().catch(console.error);