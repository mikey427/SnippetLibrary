#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple CLI for the snippet library
// Since we can't easily import the compiled TypeScript, we'll work with JSON files directly

const SNIPPETS_FILE = './snippets.json';

// Utility functions
function loadSnippets() {
  if (!fs.existsSync(SNIPPETS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(SNIPPETS_FILE, 'utf8');
    const parsed = JSON.parse(data);
    return parsed.snippets || [];
  } catch (error) {
    console.error('❌ Error loading snippets:', error.message);
    return [];
  }
}

function saveSnippets(snippets) {
  const data = {
    snippets,
    metadata: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      count: snippets.length
    }
  };
  
  try {
    fs.writeFileSync(SNIPPETS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Error saving snippets:', error.message);
    return false;
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// CLI Commands
function addSnippet(title, code, language = 'text', description = '', tags = []) {
  const snippets = loadSnippets();
  
  const newSnippet = {
    id: generateId(),
    title,
    description,
    code,
    language,
    tags: Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()),
    category: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    usageCount: 0
  };
  
  snippets.push(newSnippet);
  
  if (saveSnippets(snippets)) {
    console.log(`✅ Added snippet: "${title}"`);
    console.log(`   ID: ${newSnippet.id}`);
    console.log(`   Language: ${language}`);
    console.log(`   Tags: ${newSnippet.tags.join(', ') || 'none'}`);
  }
}

function listSnippets(filter = null) {
  const snippets = loadSnippets();
  
  if (snippets.length === 0) {
    console.log('📝 No snippets found. Add some with: node cli.js add "title" "code"');
    return;
  }
  
  let filtered = snippets;
  
  if (filter) {
    const searchTerm = filter.toLowerCase();
    filtered = snippets.filter(s => 
      s.title.toLowerCase().includes(searchTerm) ||
      s.description.toLowerCase().includes(searchTerm) ||
      s.code.toLowerCase().includes(searchTerm) ||
      s.language.toLowerCase().includes(searchTerm) ||
      s.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }
  
  console.log(`📋 Found ${filtered.length} snippet(s):\n`);
  
  filtered.forEach((snippet, index) => {
    console.log(`${index + 1}. ${snippet.title}`);
    console.log(`   ID: ${snippet.id}`);
    console.log(`   Language: ${snippet.language}`);
    console.log(`   Tags: ${snippet.tags.join(', ') || 'none'}`);
    console.log(`   Usage: ${snippet.usageCount} times`);
    if (snippet.description) {
      console.log(`   Description: ${snippet.description}`);
    }
    console.log(`   Code:`);
    console.log('   ' + snippet.code.split('\\n').join('\\n   '));
    console.log('');
  });
}

function getSnippet(id) {
  const snippets = loadSnippets();
  const snippet = snippets.find(s => s.id === id || s.title.toLowerCase().includes(id.toLowerCase()));
  
  if (!snippet) {
    console.log(`❌ Snippet not found: ${id}`);
    return;
  }
  
  console.log(`📄 ${snippet.title}`);
  console.log(`   ID: ${snippet.id}`);
  console.log(`   Language: ${snippet.language}`);
  console.log(`   Tags: ${snippet.tags.join(', ') || 'none'}`);
  console.log(`   Usage: ${snippet.usageCount} times`);
  console.log(`   Created: ${new Date(snippet.createdAt).toLocaleDateString()}`);
  if (snippet.description) {
    console.log(`   Description: ${snippet.description}`);
  }
  console.log(`\n📝 Code:`);
  console.log(snippet.code);
  
  // Increment usage
  snippet.usageCount++;
  snippet.updatedAt = new Date().toISOString();
  saveSnippets(snippets);
}

function copySnippet(id) {
  const snippets = loadSnippets();
  const snippet = snippets.find(s => s.id === id || s.title.toLowerCase().includes(id.toLowerCase()));
  
  if (!snippet) {
    console.log(`❌ Snippet not found: ${id}`);
    return;
  }
  
  // Try to copy to clipboard (Windows)
  const { spawn } = require('child_process');
  const child = spawn('clip', [], { stdio: 'pipe' });
  child.stdin.write(snippet.code);
  child.stdin.end();
  
  child.on('close', (code) => {
    if (code === 0) {
      console.log(`📋 Copied "${snippet.title}" to clipboard!`);
      console.log(`   Language: ${snippet.language}`);
      console.log(`   Code: ${snippet.code.substring(0, 50)}${snippet.code.length > 50 ? '...' : ''}`);
    } else {
      console.log(`❌ Failed to copy to clipboard. Here's the code:`);
      console.log(snippet.code);
    }
  });
  
  // Increment usage
  snippet.usageCount++;
  snippet.updatedAt = new Date().toISOString();
  saveSnippets(snippets);
}

function insertSnippet(id, filePath) {
  const snippets = loadSnippets();
  const snippet = snippets.find(s => s.id === id || s.title.toLowerCase().includes(id.toLowerCase()));
  
  if (!snippet) {
    console.log(`❌ Snippet not found: ${id}`);
    return;
  }
  
  if (!filePath) {
    console.log(`❌ File path required for insertion`);
    return;
  }
  
  try {
    const fs = require('fs');
    
    // Read current file content
    let content = '';
    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf8');
    }
    
    // Add snippet at the end with some spacing
    const newContent = content + (content ? '\n\n' : '') + `// ${snippet.title}\n${snippet.code}\n`;
    
    // Write back to file
    fs.writeFileSync(filePath, newContent);
    
    console.log(`✅ Inserted "${snippet.title}" into ${filePath}`);
    console.log(`   Added ${snippet.code.split('\n').length} lines`);
    
    // Increment usage
    snippet.usageCount++;
    snippet.updatedAt = new Date().toISOString();
    saveSnippets(snippets);
    
  } catch (error) {
    console.log(`❌ Error inserting snippet: ${error.message}`);
  }
}

function deleteSnippet(id) {
  const snippets = loadSnippets();
  const index = snippets.findIndex(s => s.id === id || s.title.toLowerCase().includes(id.toLowerCase()));
  
  if (index === -1) {
    console.log(`❌ Snippet not found: ${id}`);
    return;
  }
  
  const deleted = snippets.splice(index, 1)[0];
  
  if (saveSnippets(snippets)) {
    console.log(`✅ Deleted snippet: "${deleted.title}"`);
  }
}

function showStats() {
  const snippets = loadSnippets();
  
  if (snippets.length === 0) {
    console.log('📊 No snippets to analyze');
    return;
  }
  
  const totalUsage = snippets.reduce((sum, s) => sum + s.usageCount, 0);
  const languages = [...new Set(snippets.map(s => s.language))];
  const tags = [...new Set(snippets.flatMap(s => s.tags))];
  const mostUsed = snippets.sort((a, b) => b.usageCount - a.usageCount)[0];
  
  console.log('📊 Snippet Library Statistics');
  console.log('============================');
  console.log(`Total snippets: ${snippets.length}`);
  console.log(`Total usage: ${totalUsage}`);
  console.log(`Average usage: ${(totalUsage / snippets.length).toFixed(1)}`);
  console.log(`Languages: ${languages.join(', ')}`);
  console.log(`Tags: ${tags.join(', ')}`);
  console.log(`Most used: ${mostUsed.title} (${mostUsed.usageCount} times)`);
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'add':
    if (args.length < 3) {
      console.log('Usage: node cli.js add "title" "code" [language] [description] [tags]');
      console.log('Example: node cli.js add "Hello World" "console.log(\'Hello\');" "javascript" "Simple greeting" "basic,example"');
    } else {
      addSnippet(args[1], args[2], args[3], args[4], args[5]);
    }
    break;
    
  case 'list':
  case 'ls':
    listSnippets(args[1]);
    break;
    
  case 'get':
  case 'show':
    if (args.length < 2) {
      console.log('Usage: node cli.js get <id-or-title>');
    } else {
      getSnippet(args[1]);
    }
    break;
    
  case 'copy':
  case 'cp':
    if (args.length < 2) {
      console.log('Usage: node cli.js copy <id-or-title>');
    } else {
      copySnippet(args[1]);
    }
    break;
    
  case 'insert':
  case 'paste':
    if (args.length < 3) {
      console.log('Usage: node cli.js insert <id-or-title> <file-path>');
    } else {
      insertSnippet(args[1], args[2]);
    }
    break;
    
  case 'delete':
  case 'rm':
    if (args.length < 2) {
      console.log('Usage: node cli.js delete <id-or-title>');
    } else {
      deleteSnippet(args[1]);
    }
    break;
    
  case 'stats':
    showStats();
    break;
    
  case 'help':
  default:
    console.log('🚀 Snippet Library CLI');
    console.log('======================');
    console.log('');
    console.log('Commands:');
    console.log('  add <title> <code> [lang] [desc] [tags]  Add a new snippet');
    console.log('  list [filter]                            List all snippets (with optional filter)');
    console.log('  get <id-or-title>                        Show a specific snippet');
    console.log('  copy <id-or-title>                       Copy snippet to clipboard');
    console.log('  insert <id-or-title> <file>              Insert snippet into file');
    console.log('  delete <id-or-title>                     Delete a snippet');
    console.log('  stats                                    Show library statistics');
    console.log('  help                                     Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  node cli.js add "React Hook" "const [state, setState] = useState()" "javascript"');
    console.log('  node cli.js list react');
    console.log('  node cli.js get "React Hook"');
    console.log('  node cli.js stats');
    break;
}