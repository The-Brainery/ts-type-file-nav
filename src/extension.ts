import * as vscode from 'vscode';
import ts from 'typescript';


export function activate(context: vscode.ExtensionContext) {
    const definitionProvider = vscode.languages.registerDefinitionProvider(
        { language: 'typescript', scheme: 'file' },
        {
            provideDefinition: async (document, position, token) => {
                const program = await createTypeScriptProgram(document.fileName);
                const sourceFile = program.getSourceFile(document.fileName);
                const offset = document.offsetAt(position);
				const checker = program.getTypeChecker();

                if (!sourceFile) return null;

                // Find the node at the clicked position
                const node = findNodeAtOffset(sourceFile, offset);
                if (!node) return null;

				const symbol = checker.getSymbolAtLocation(node);
                if (!symbol) return null;

				const declarations = symbol.getDeclarations();
                if (!declarations || declarations.length === 0) return null

				const targetDeclaration = declarations[0];
                const targetFile = targetDeclaration.getSourceFile();


                // Check if the node is in a `.d.ts` file
                if (targetFile.fileName.endsWith('.d.ts')) {
                    // Parse the comment above the node
                    const comment = getLeadingCommentAboveNode(targetDeclaration, targetFile);
                    if (comment) {
                        const match = comment.match(/@line (\d+) @path (.+)/);
						if (match) {
							const line = parseInt(match[1], 10) - 1; // Convert to 0-based index
							const path = match[2].trim(); // Ensure no extra spaces in the path

							// Ensure the file exists before attempting navigation
							const fileUri = vscode.Uri.file(path);
							try {
								const document = await vscode.workspace.openTextDocument(fileUri);
								await vscode.window.showTextDocument(document, { preview: true });
								const position = new vscode.Position(line, 0);
								const editor = vscode.window.activeTextEditor;
								if (editor) {
									editor.selection = new vscode.Selection(position, position);
									editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
								}
							} catch (error) {
								vscode.window.showErrorMessage(`Failed to open file: ${path}`);
								console.error(error);
							}
						}
                    }
                }

                // Fallback to the default behavior
                return null; // This allows VS Code to use its default provider
            },
        }
    );

    context.subscriptions.push(definitionProvider);
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

function getLeadingCommentAboveNode(node: ts.Node, sourceFile: ts.SourceFile): string | null {
    const fullText = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(fullText, node.getFullStart());

    if (!commentRanges || commentRanges.length === 0) return null

    // Find the comment immediately preceding the node
    const lastCommentRange = commentRanges[commentRanges.length - 1];
    const commentText = fullText.slice(lastCommentRange.pos, lastCommentRange.end).trim();
    return commentText;
}

async function createTypeScriptProgram(filePath: string): Promise<ts.Program> {
    const options: ts.CompilerOptions = {
        allowJs: true,
        checkJs: true,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.CommonJS,
    };

    return ts.createProgram([filePath], options);
}

export function deactivate() {}