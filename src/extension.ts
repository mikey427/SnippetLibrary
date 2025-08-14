import * as vscode from "vscode";
import { SnippetLibraryExtension } from "./extension/SnippetLibraryExtension";

let extensionInstance: SnippetLibraryExtension | undefined;

/**
 * Extension activation function
 * Called when the extension is activated
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log("Snippet Library extension is now active");

  try {
    // Create and initialize the extension instance
    extensionInstance = new SnippetLibraryExtension(context);
    await extensionInstance.initialize();

    console.log("Snippet Library extension initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Snippet Library extension:", error);
    vscode.window.showErrorMessage(
      `Failed to initialize Snippet Library: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Extension deactivation function
 * Called when the extension is deactivated
 */
export async function deactivate(): Promise<void> {
  console.log("Snippet Library extension is now deactivating");

  try {
    if (extensionInstance) {
      await extensionInstance.dispose();
      extensionInstance = undefined;
    }
    console.log("Snippet Library extension deactivated successfully");
  } catch (error) {
    console.error("Error during extension deactivation:", error);
  }
}
