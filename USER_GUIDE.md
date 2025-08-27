# Snippet Library - New User Guide

Welcome! The Snippet Library is a powerful VS Code extension that helps you save, organize, and reuse code snippets. Think of it as your personal code collection that works both inside VS Code and through a web interface.

## 🎯 What You Can Do

- **Save code snippets** from VS Code with just a few keystrokes
- **Insert saved snippets** quickly while coding
- **Organize snippets** with tags, categories, and descriptions
- **Search through your collection** to find exactly what you need
- **Manage everything visually** through a web interface
- **Import/export** your snippets to share or backup

## 🚀 Getting Started

### 1. Installation & Setup

First, you'll need to install and build the extension:

```bash
# Clone and install
git clone <repository-url>
cd snippet-library
npm install
npm run compile

# Install in VS Code
# Press F5 to open Extension Development Host
# Or package: npm run package and install the .vsix file
```

### 2. Your First Snippet

Let's save your first code snippet:

1. **Select some code** in VS Code (try selecting a function or a useful line)
2. **Press `Ctrl+Shift+S`** (or `Cmd+Shift+S` on Mac)
3. **Fill in the details**:
   - **Title**: Give it a descriptive name like "Console Log Helper"
   - **Description**: Explain what it does
   - **Tags**: Add keywords like "debug", "logging", "javascript"
4. **Click Save**

That's it! Your snippet is now saved.

### 3. Using Your Snippets

To insert a saved snippet:

1. **Place your cursor** where you want the code
2. **Press `Ctrl+Shift+I`** (or `Cmd+Shift+I` on Mac)
3. **Search and select** your snippet
4. **Press Enter** - the code appears at your cursor!

### 4. Visual Management (Optional)

For advanced management, open the web interface:

1. **Open Command Palette** (`Ctrl+Shift+P`)
2. **Type "Snippet Library: Open Web GUI"**
3. **Press Enter**

A web page opens where you can:

- See all your snippets in a visual grid
- Search and filter by language, tags, or content
- Edit snippets with syntax highlighting
- Organize with drag-and-drop
- Perform bulk operations

## 🔍 Key Features Explained

### Smart Search

The search is powerful - you can find snippets by:

- **Text**: Search in titles, descriptions, and code
- **Language**: `lang:javascript` finds only JavaScript snippets
- **Tags**: `tag:react` finds React-related snippets
- **Exact phrases**: `"console.log"` finds exact matches

### Organization

Keep your snippets organized:

- **Tags**: Add multiple tags like "react", "hooks", "state"
- **Categories**: Group related snippets (e.g., "React Components", "Utilities")
- **Languages**: Automatically detected from your code
- **Descriptions**: Add detailed explanations

### Import/Export

Share or backup your collection:

- **Export**: Save all snippets to a JSON file
- **Import**: Load snippets from files
- **VS Code format**: Compatible with VS Code's built-in snippets

## 💡 Common Workflows

### For Daily Coding

1. **Save as you code**: When you write something useful, immediately save it
2. **Use descriptive titles**: "React useState Hook" is better than "Hook"
3. **Add good tags**: Think about how you'll search for it later
4. **Quick insert**: Use `Ctrl+Shift+I` to quickly find and insert

### For Team Sharing

1. **Export your collection**: Use "Export All Snippets" command
2. **Share the file**: Send the JSON file to teammates
3. **Import on other machines**: Use "Import Snippets" command
4. **Standardize tags**: Agree on common tags with your team

### For Learning

1. **Save examples**: When you learn something new, save an example
2. **Add explanations**: Use descriptions to explain complex code
3. **Tag by topic**: Use tags like "algorithms", "patterns", "examples"
4. **Review regularly**: Browse your collection to refresh your memory

## 💪 Tips for Success

### Good Snippet Practices

- **Keep snippets focused**: One concept per snippet
- **Use clear titles**: "JWT Token Validation" vs "Token Thing"
- **Add context**: Explain when and why to use the snippet
- **Include imports**: Save the necessary import statements too

### Effective Tagging

- **Be consistent**: Always use "react" not sometimes "React" or "reactjs"
- **Use multiple tags**: A React component might have tags: "react", "component", "ui"
- **Think about search**: Tag with words you'd actually search for

### Organization Strategies

- **By technology**: Group by language or framework
- **By purpose**: "utilities", "components", "configs"
- **By complexity**: "beginner", "advanced", "examples"
- **By project**: Tag with project names for project-specific code

## ⌨️ Keyboard Shortcuts

| Action         | Windows/Linux  | Mac           | What it does                     |
| -------------- | -------------- | ------------- | -------------------------------- |
| Save Snippet   | `Ctrl+Shift+S` | `Cmd+Shift+S` | Save selected code as snippet    |
| Insert Snippet | `Ctrl+Shift+I` | `Cmd+Shift+I` | Search and insert a snippet      |
| Open Web GUI   | -              | -             | Open visual management interface |

You can customize these shortcuts in VS Code's keyboard settings.

## 🔧 Troubleshooting

### Extension Not Working?

1. **Check VS Code version**: Needs 1.74.0 or higher
2. **Reload window**: `Ctrl+Shift+P` → "Developer: Reload Window"
3. **Check output**: View → Output → Select "Snippet Library"

### Can't Save Snippets?

1. **Check permissions**: Make sure VS Code can write to your user folder
2. **Try different location**: Change storage location in settings
3. **Check disk space**: Ensure you have available storage

### Web GUI Won't Open?

1. **Check port**: Default is 3000, might be in use
2. **Try different port**: Change in settings
3. **Check firewall**: Make sure localhost connections are allowed

## 🆘 Getting Help

- **Check the documentation**: README.md has detailed information
- **Look at examples**: The demo.js file shows usage examples
- **Ask questions**: Create an issue on GitHub with your question
- **Share feedback**: Let us know what features you'd like to see

## 🎉 What's Next?

Once you're comfortable with the basics:

1. **Explore the web interface** for advanced management
2. **Set up team sharing** if you work with others
3. **Customize settings** to match your workflow
4. **Try advanced search** with operators and filters
5. **Export/import** to backup or share your collection

The Snippet Library grows more valuable as you use it. Start small, save snippets as you encounter useful code, and soon you'll have a powerful personal code library that speeds up your development!

---

**Happy coding!** 🚀

_For more detailed information, check out the README.md and DEVELOPER_GUIDE.md files in this repository._
