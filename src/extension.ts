import * as vscode from 'vscode';
import pathResolver from 'path';
import ts from 'typescript';
import glob from 'glob';


export function activate(context: vscode.ExtensionContext) {

	let lastCMDEvent = Infinity;

	// const keyPressCommand = vscode.commands.registerCommand('extension.keyPress', () => {
	// 	lastCMDEvent = Date.now();
	// });
	
	// context.subscriptions.push(keyPressCommand);
	
	const clickListener = vscode.window.onDidChangeTextEditorSelection(async (event) => {
		if (Date.now() - lastCMDEvent > 1000) {
			return;
		}
		const editor = event.textEditor;
		const position = editor.selection.active;

		const program = createTypeScriptProgram(editor.document.fileName);
		const sourceFiles = program.getSourceFiles();
		const sourceFile = program.getSourceFile(editor.document.fileName);
		const offset = editor.document.offsetAt(position);
		const checker = program.getTypeChecker();

		let typeDefinitionLocations;

		const node = sourceFile ? findNodeAtOffset(sourceFile, offset) : undefined;
		const type = node ? checker.getTypeAtLocation(node) : undefined;
		const definitionLocation = node ? getDefinitionLocation(node, checker) : undefined;

		
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

function getDefinitionLocation(
    node: ts.Node,
    checker: ts.TypeChecker
): { fileName: string; line: number; character: number } | undefined {
    const symbol = checker.getSymbolAtLocation(node);

    if (symbol) {
		const declarations = symbol.getDeclarations() || [];

		for (let declaration of declarations) {
			const sourceFile = declaration.getSourceFile();
			const { line, character } = sourceFile.getLineAndCharacterOfPosition(declaration.getStart());

			return {
                fileName: sourceFile.fileName,
                line: line + 1, // Convert to 1-based line index
                character: character + 1, // Convert to 1-based character index
            };

		}
    }

    return undefined;
}

function findNodeAtOffset(sourceFile: ts.SourceFile, offset: number): ts.Node | undefined {
    let matchingNode: ts.Node | undefined;

    const visit = (node: ts.Node) => {
        if (node.getStart(sourceFile) <= offset && node.getEnd() >= offset) {
            matchingNode = node;
            ts.forEachChild(node, visit);
        }
    };

    ts.forEachChild(sourceFile, visit);
    return matchingNode;
}

function getFiles(pattern: string) {
	return new Promise((resolve, reject) => {
	  //@ts-ignore
	  glob(pattern, (err, files) => {
		if (err) {
		  reject(err);
		} else {
		  resolve(files);
		}
	  });
	});
}

async function createTypeScriptProgram(filePath: string): Promise<ts.Program> {
	const options: ts.CompilerOptions = {
		allowJs: true, // For JavaScript support
		checkJs: true,
		target: ts.ScriptTarget.ESNext,
		module: ts.ModuleKind.CommonJS
	};

	const filePaths = vscode.workspace.workspaceFolders?.map( (f) => f.uri.path) || []
	let allPaths = [];

	for (let filePath of filePaths) {
		allPaths.push(pathResolver.resolve(filePath, '**', '*.ts'));
		allPaths.push(pathResolver.resolve(filePath, '**', '*.d.ts'));
		allPaths.push(pathResolver.resolve(filePath, '*.ts'));
		allPaths.push(pathResolver.resolve(filePath, '*.d.ts'));
	}
	return ts.createProgram(await getFiles(`${filePaths[0]}/**/*.ts${filePaths[0]}/**/*.d.ts,`), options);
}



export function deactivate() {}