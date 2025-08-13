import * as vscode from "vscode";

/**
 * Extension activation function
 * Called when the extension is activated
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Snippet Library extension is now active");

  // Register placeholder commands - these will be implemented in later tasks
  const commands = [
    vscode.commands.registerCommand("snippetLibrary.saveSnippet", () => {
      vscode.window.showInformationMessage(
        "Save Snippet command - to be implemented"
      );
    }),

    vscode.commands.registerCommand("snippetLibrary.insertSnippet", () => {
      vscode.window.showInformationMessage(
        "Insert Snippet command - to be implemented"
      );
    }),

    vscode.commands.registerCommand("snippetLibrary.manageSnippets", () => {
      vscode.window.showInformationMessage(
        "Manage Snippets command - to be implemented"
      );
    }),

    vscode.commands.registerCommand("snippetLibrary.openWebGUI", () => {
      vscode.window.showInformationMessage(
        "Open Web GUI command - to be implemented"
      );
    }),
  ];

  // Add all commands to the extension context
  commands.forEach((command) => context.subscriptions.push(command));

  // Show activation message
  vscode.window.showInformationMessage(
    "Snippet Library extension activated successfully!"
  );
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export function deactivate() {
  console.log("Snippet Library extension is now deactivated");
}
