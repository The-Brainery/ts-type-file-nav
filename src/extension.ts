import * as vscode from 'vscode';
import pathResolver from 'path';

export function activate(context: vscode.ExtensionContext) {

	let lastCMDEvent = Infinity;

	const keyPressCommand = vscode.commands.registerCommand('extension.keyPress', () => {
		lastCMDEvent = Date.now();
	});
	
	context.subscriptions.push(keyPressCommand);
	
	const clickListener = vscode.window.onDidChangeTextEditorSelection((event) => {
		if (Date.now() - lastCMDEvent > 1000) {
			return;
		}
		const editor = event.textEditor;
		const position = editor.selection.active;
		
		// Check if the click happened near a word or inside a tooltip region
		const wordRange = editor.document.getWordRangeAtPosition(position);
		if (wordRange) {
			const word = editor.document.getText(wordRange);
			
			const isPatternMatch = (line: string): boolean => {
				const pattern = /\/\*\* @line \d+ @column \d+ @path .+\*\//;
				return pattern.test(line);
			}
			
			const currentIndentationLevel = getIndentationLevel(editor.document.lineAt(position.line).text);
			
			let lineNumberAbove = position.line - 1;
			let foundPattern = false;
			let matchedLine = '';
			let line = 0, column = 0, path = '';
			
			while (lineNumberAbove >= 0) {
				const lineText = editor.document.lineAt(lineNumberAbove).text;
				
				const previousIndentationLevel = getIndentationLevel(lineText);
				
				// If indentation level is less, break out of the loop (stop checking higher lines)
				if (previousIndentationLevel > currentIndentationLevel) {
					break;
				}
				
				// If the line matches the pattern, we're done
				if (isPatternMatch(lineText)) {
					const match = lineText.match(/\/\*\* @line (\d+) @column (\d+) @path (.+) \*\//);
					
					// Extract line, column, and path from the comment
					if (match) {
						line = parseInt(match[1], 10) - 1;  // Convert to 0-based index
						column = parseInt(match[2], 10) - 1; // Convert to 0-based index
						path = match[3];
						foundPattern = true;
						matchedLine = lineText;
						break;
					}
				}
				
				
				// Move to the next line above
				lineNumberAbove--;
			}
			
			if (foundPattern) {
				console.log(`Found definition for clicked word: ${word}`);
				
				const fileUri = vscode.Uri.file(pathResolver.resolve(editor.document.fileName, '..', path))
				
				vscode.workspace.openTextDocument(fileUri).then((document) => {
					vscode.window.showTextDocument(document).then((editor) => {
						// Move the cursor to the specific line and column
						const targetPosition = new vscode.Position(line, column);
						editor.selection = new vscode.Selection(targetPosition, targetPosition);
						editor.revealRange(new vscode.Range(targetPosition, targetPosition));
					})
				}, (error) => {
					vscode.window.showErrorMessage(`Failed to open file at ${path}`);
				})
				
				
				vscode.window.showInformationMessage(`Opening file at ${path}, line: ${line + 1}, column: ${column + 1}`);
			}
		}
	});
	
	context.subscriptions.push(clickListener);
}

function getIndentationLevel(line: string): number {
	const match = line.match(/^\s*/); // Match leading spaces/tabs
	return match ? match[0].length : 0; // Return the length of leading spaces/tabs
}

export function deactivate() {}