import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { isError, Error as SemlError } from './error';
import { parse } from './parser';
import { exec, execFile, ExecFileException } from 'child_process';
import { templates } from './templates';
import { extractSemlBlocks, SemlBlock } from './block_extractor';


function executeTestFromText(text: string, testName: string, baseName: string, dirName: string, lineOffset: number) {
	const parsedOutput = parse(text);
	if (isError(parsedOutput)) {
		const lineNum = parsedOutput.lineNum + lineOffset;
		vscode.window.showErrorMessage(`[第${lineNum}行] ${parsedOutput.msg}: ${parsedOutput.src}`);
		return;
	}

	const { out, args } = parsedOutput;
	const jsonOutput = JSON.stringify(out, null, 4);
	const jsonFilePath = path.join(dirName, `${baseName}.json`);

	const destDirName = path.join(dirName, "dest");
	if (!fs.existsSync(destDirName)) {
		fs.mkdirSync(destDirName);
	}

	fs.writeFile(jsonFilePath, jsonOutput, "utf8", function (err) {
		if (err) {
			vscode.window.showErrorMessage(`JSON 保存失败: ${err}`);
			return;
		}

		runBinary(`${testName.toLowerCase()}_test.exe`,
			[...Object.values(args).flatMap(x => x),
				"-f", jsonFilePath,
				"-o", path.join(destDirName, baseName + `_${testName.toLowerCase()}`)],
			jsonFilePath);
	});
}

function runBinary(filename: string, args: string[], jsonFilePath: string) {
	const binaryPath = path.join(__dirname, "bin", filename);

	execFile(binaryPath, args, (err: ExecFileException | null, stdout: string, stderr: string) => {
		if (err) {
			vscode.window.showErrorMessage(`出错: ${err}`);
			return;
		}
		if (stderr) {
			vscode.window.showErrorMessage(`出错: ${stderr}`);
			return;
		}

		fs.unlink(jsonFilePath, (err) => {
			if (err) {
				vscode.window.showErrorMessage(`删除 JSON 临时文件时出错: ${err}`);
				return;
			}
		});

		vscode.window.showInformationMessage(`${stdout}`, "打开文件").then(selection => {
			if (selection === "打开文件") {
				const regex = /输出文件已保存至 (.+).\s+?耗时/;
				const match = stdout.match(regex);
				if (match !== null) {
					exec(`start "" "${match[1]}"`, (error) => {
						if (error) {
							vscode.window.showErrorMessage(`无法打开文件: ${error.message}`);
						}
					});
				} else {
					vscode.window.showErrorMessage(`无法识别文件名`);
				}
			}
		});
	});
}

function compileToJson(doc: vscode.TextDocument)
	: { dirName: string, baseName: string, jsonFilePath: string, jsonOutput: string, args: { [key: string]: string[] } } | undefined {
	const parsedOutput = parse(doc.getText());
	if (isError(parsedOutput)) {
		const { lineNum, msg, src } = parsedOutput;
		vscode.window.showErrorMessage(`[第${lineNum}行] ${msg}: ${src}`);
		return;
	}

	const { out, args } = parsedOutput;

	const semlFilePath = doc.uri.fsPath;
	if (path.extname(semlFilePath) !== ".seml") {
		vscode.window.showErrorMessage("请打开 .seml 文件");
		return;
	}

	const dirName = path.dirname(semlFilePath);
	const baseName = path.basename(semlFilePath, ".seml");

	return {
		dirName,
		baseName,
		jsonFilePath: path.join(dirName, `${baseName}.json`),
		jsonOutput: JSON.stringify(out, null, 4),
		args
	};
}

export function activate(context: vscode.ExtensionContext) {

	context.subscriptions.push(vscode.commands.registerCommand('seml.compileToJson', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			vscode.window.showErrorMessage(`请先打开文件`);
			return;
		}

		const compiledJson = compileToJson(editor.document);
		if (compiledJson === undefined) {
			return;
		}

		const { jsonFilePath, jsonOutput } = compiledJson;
		fs.writeFile(jsonFilePath, jsonOutput, "utf8", function (err) {
			if (err) {
				vscode.window.showErrorMessage(`JSON 保存失败: ${err.message}`);
				return;
			}

			vscode.workspace.openTextDocument(jsonFilePath).then(doc => {
				vscode.window.showTextDocument(doc);
			});
		});
	}));

	for (const testName of ["Smash", "Explode", "Refresh", "Pogo", "Pos", "Imp"]) {
		context.subscriptions.push(vscode.commands.registerCommand(`seml.test${testName}`, () => {
			const editor = vscode.window.activeTextEditor;
			if (editor === undefined) {
				vscode.window.showErrorMessage(`请先打开文件`);
				return;
			}

			const doc = editor.document;
			const semlFilePath = doc.uri.fsPath;
			if (path.extname(semlFilePath) !== ".seml") {
				vscode.window.showErrorMessage("请打开 .seml 文件");
				return;
			}

			const dirName = path.dirname(semlFilePath);
			const baseName = path.basename(semlFilePath, ".seml");

			executeTestFromText(doc.getText(), testName, baseName, dirName, 0);
		}));

		context.subscriptions.push(vscode.commands.registerCommand(`seml.use${testName}Template`, () => {
			const editor = vscode.window.activeTextEditor;
			if (editor === undefined) {
				vscode.window.showErrorMessage(`请先打开文件`);
				return;
			}
			const doc = editor.document;
			if (path.extname(doc.uri.fsPath) !== ".seml") {
				vscode.window.showErrorMessage("请打开 .seml 文件");
				return;
			}
			const fullRange = new vscode.Range(
				doc.positionAt(0),
				doc.positionAt(doc.getText().length)
			);
			editor.edit(editBuilder => {
				editBuilder.replace(fullRange, templates[testName]!);
			});
			if (!context.globalState.get('noTemplateCtrlZMessage')) {
				vscode.window.showInformationMessage("已使用模板. 可用 Ctrl+Z 撤销此操作.", "不再显示")
						.then(selection => {
							if (selection === "不再显示") {
								context.globalState.update('noTemplateCtrlZMessage', true);
							}
						});
			}
		}));
	}

	context.subscriptions.push(vscode.commands.registerCommand('seml.testBlocks', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor === undefined) {
			vscode.window.showErrorMessage(`请先打开文件`);
			return;
		}

		const doc = editor.document;
		const text = doc.getText();
		const filePath = doc.uri.fsPath;
		const dirName = path.dirname(filePath);
		const sourceBaseName = path.basename(filePath, path.extname(filePath));

		const blocks = extractSemlBlocks(text);

		const errors: SemlError[] = [];
		const testableBlocks: SemlBlock[] = [];
		for (const block of blocks) {
			if (isError(block)) {
				errors.push(block);
			} else {
				testableBlocks.push(block);
			}
		}

		if (testableBlocks.length === 0 && errors.length === 0) {
			vscode.window.showErrorMessage("未找到可测试的 seml 代码块");
			return;
		}

		for (const err of errors) {
			vscode.window.showErrorMessage(`[第${err.lineNum}行] ${err.msg}: ${err.src}`);
		}

		const usedNames = new Set<string>();
		const resolvedNames: string[] = [];

		for (let i = 0; i < testableBlocks.length; i++) {
			const block = testableBlocks[i]!;
			let baseName = block.name ?? `${sourceBaseName}_${i + 1}`;

			let suffix = 1;
			let finalName = baseName;
			while (usedNames.has(finalName)) {
				suffix++;
				finalName = `${baseName}_${suffix}`;
			}

			usedNames.add(finalName);
			resolvedNames.push(finalName);
		}

		for (let i = 0; i < testableBlocks.length; i++) {
			const block = testableBlocks[i]!;
			const baseName = resolvedNames[i]!;
			executeTestFromText(
				block.content,
				block.type,
				baseName,
				dirName,
				block.startLine - 1
			);
		}
	}));
}

export function deactivate() { }
