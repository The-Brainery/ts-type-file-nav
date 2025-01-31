import * as vscode from 'vscode';
import ts from 'typescript';
import path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let targetFilePath = null as string | null;
    let targetFileLine = null as number | null;
    let definitionActive = false;
    let program = null as ts.Program | null;
    let sourceFile = undefined as ts.SourceFile | undefined;
    let checker = null as ts.TypeChecker | null;
    let _initialized = false;
    let currentFile = null as string | null;

    const setupTypescript = async (fileName: string) => {
        if (currentFile === fileName) { return; }
        currentFile = fileName;
        program = await createTypeScriptProgram(fileName);
        sourceFile = program.getSourceFile(fileName);
        checker = program.getTypeChecker();
    }

    vscode.workspace.onDidOpenTextDocument((document) => {
        if (_initialized) { return; }
        _initialized = true;
        setupTypescript(document.uri.fsPath);
        context.subscriptions.push(definitionProvider);
        const clickListener = vscode.window.onDidChangeTextEditorSelection(clickHandler);
        context.subscriptions.push(clickListener);
        console.log(`Opened file: ${document.uri.fsPath}`);
    });

    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (!editor) { return; }
        setupTypescript(editor.document.uri.fsPath);
    });


    const clickHandler = async (e: any) => {
        if (!definitionActive) { return; }
        if (!targetFilePath) {return;}
        if (!(program && sourceFile && checker)) {return;}

        definitionActive = false;
        // Ensure the file exists before attempting navigation
        const fileUri = vscode.Uri.file(targetFilePath);
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(document, { preview: true });
            const position = new vscode.Position(targetFileLine ?? 0, 0);
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${path}`);
            console.error(error);
        }
    };

    const definitionProvider = vscode.languages.registerDefinitionProvider(
        { language: 'typescript', scheme: 'file' },
        {
            provideDefinition: async (document, position, token) => {
                if (!(program && sourceFile && checker)) {return;}

                definitionActive = true;
                setTimeout(() => {
                    definitionActive = false;
                }, 2000);

                targetFilePath = null;
                targetFileLine = null;
                const offset = document.offsetAt(position);
                if (!sourceFile) {return null;}
    
                // Find the node at the clicked position
                const node = findNodeAtOffset(sourceFile, offset);
                if (!node) {return null;}
                
                const symbol = checker.getSymbolAtLocation(node);
                if (!symbol) {return null;}
            
                const declarations = symbol.getDeclarations();
                if (!declarations || declarations.length === 0) {
                    return null;
                }
    
                const targetDeclaration = declarations[0];
                const targetFile = targetDeclaration.getSourceFile();
    
                // Check if the node is in a `.d.ts` file
                if (targetFile.fileName.endsWith('.d.ts')) {
                    // Parse the comment above the node
                    const comment = getLeadingCommentAboveNode(targetDeclaration, targetFile);
                    if (comment) {
                        const match = comment.match(/File:\/\/(.+):(\d+)/);
                        if (match) {
                            targetFileLine = parseInt(match[2], 10) - 1; // Convert to 0-based index
                            targetFilePath = path.resolve(targetFile.fileName, '..', match[1].trim()); // Ensure no extra spaces in the path
                            return null;
                        }
                    }
                }
                return null;
            },
        }
    );

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

    const program = ts.createProgram([filePath], options);
    return program;
}

export function deactivate() {}