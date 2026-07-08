"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const error_1 = require("./error");
const parser_1 = require("./parser");
const child_process_1 = require("child_process");
const templates_1 = require("./templates");
const block_extractor_1 = require("./block_extractor");
function resolveBinaryPath(testName) {
    const binaryName = `${testName.toLowerCase()}_test`;
    if (process.platform === "win32") {
        return path.join(__dirname, "bin", `${binaryName}.exe`);
    }
    if (process.platform === "darwin") {
        return path.join(__dirname, "bin", "darwin", binaryName);
    }
    return undefined;
}
function getBinaryError(binaryPath) {
    if (binaryPath === undefined) {
        return `不支持当前系统: ${process.platform}`;
    }
    if (!fs.existsSync(binaryPath)) {
        return `未找到测试二进制: ${binaryPath}`;
    }
    if (process.platform !== "win32") {
        try {
            fs.accessSync(binaryPath, fs.constants.X_OK);
        }
        catch {
            return `测试二进制没有执行权限: ${binaryPath}`;
        }
    }
    return undefined;
}
function extractOutputFile(stdout) {
    const regex = /输出文件已保存至 (.+)\.\s+?耗时/;
    const match = stdout.match(regex);
    return match?.[1];
}
function formatExecError(err, binaryPath) {
    const code = err.code === undefined ? "" : String(err.code);
    const message = err.message;
    if (code === "EACCES") {
        return `测试二进制没有执行权限: ${binaryPath}`;
    }
    if (code === "ENOEXEC" || message.includes("Bad CPU type") || message.includes("Exec format")) {
        return `测试二进制架构不兼容或格式错误: ${binaryPath}`;
    }
    return `出错: ${err}`;
}
function executeTestFromText(text, testName, baseName, dirName, lineOffset) {
    const parsedOutput = (0, parser_1.parse)(text);
    if ((0, error_1.isError)(parsedOutput)) {
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
        runBinary(testName, [...Object.values(args).flatMap(x => x),
            "-f", jsonFilePath,
            "-o", path.join(destDirName, baseName + `_${testName.toLowerCase()}`)], jsonFilePath);
    });
}
function runBinary(testName, args, jsonFilePath) {
    const binaryPath = resolveBinaryPath(testName);
    const binaryError = getBinaryError(binaryPath);
    if (binaryError !== undefined) {
        vscode.window.showErrorMessage(binaryError);
        return;
    }
    (0, child_process_1.execFile)(binaryPath, args, (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage(formatExecError(err, binaryPath));
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
                const outputFile = extractOutputFile(stdout);
                if (outputFile !== undefined) {
                    vscode.env.openExternal(vscode.Uri.file(outputFile)).then(success => {
                        if (!success) {
                            vscode.window.showErrorMessage(`无法打开文件: ${outputFile}`);
                        }
                    });
                }
                else {
                    vscode.window.showErrorMessage(`无法识别文件名`);
                }
            }
        });
    });
}
function compileToJson(doc) {
    const parsedOutput = (0, parser_1.parse)(doc.getText());
    if ((0, error_1.isError)(parsedOutput)) {
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
function activate(context) {
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
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            editor.edit(editBuilder => {
                editBuilder.replace(fullRange, templates_1.templates[testName]);
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
        const blocks = (0, block_extractor_1.extractSemlBlocks)(text);
        const errors = [];
        const testableBlocks = [];
        for (const block of blocks) {
            if ((0, error_1.isError)(block)) {
                errors.push(block);
            }
            else {
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
        const usedNames = new Set();
        const resolvedNames = [];
        for (let i = 0; i < testableBlocks.length; i++) {
            const block = testableBlocks[i];
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
            const block = testableBlocks[i];
            const baseName = resolvedNames[i];
            executeTestFromText(block.content, block.type, baseName, dirName, block.startLine - 1);
        }
    }));
}
exports.activate = activate;
function deactivate() { }
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map