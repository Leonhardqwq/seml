"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSemlBlocks = exports.parseBlockHeader = void 0;
const error_1 = require("./error");
function parseBlockHeader(header, lineNum) {
    let type;
    let name;
    const typeMatch = /\btype=(\S+)/.exec(header);
    if (typeMatch) {
        type = typeMatch[1].toLowerCase();
    }
    const nameMatch = /\bname=("[^"]*"|'[^']*'|\S+)/.exec(header);
    if (nameMatch) {
        let nameValue = nameMatch[1];
        if ((nameValue.startsWith('"') && nameValue.endsWith('"')) ||
            (nameValue.startsWith("'") && nameValue.endsWith("'"))) {
            nameValue = nameValue.slice(1, -1);
        }
        name = nameValue;
    }
    if (type === undefined) {
        return (0, error_1.error)(lineNum, "缺少 type 属性", header);
    }
    if (type !== "smash" && type !== "explode" && type !== "refresh" && type !== "pogo" && type !== "pos") {
        return (0, error_1.error)(lineNum, "无效的测试类型", type);
    }
    if (name !== undefined) {
        const unsafeChars = /[/\\:*?"<>|]/;
        if (unsafeChars.test(name)) {
            return (0, error_1.error)(lineNum, "名称包含无效字符", name);
        }
    }
    return { type, name };
}
exports.parseBlockHeader = parseBlockHeader;
function extractSemlBlocks(text) {
    const lines = text.split(/\r?\n/);
    const blocks = [];
    const openingFenceRegex = /^```seml\b/;
    const closingFenceRegex = /^```\s*$/;
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (openingFenceRegex.test(line)) {
            const headerLine = i + 1;
            const headerContent = line.slice(7).trim();
            const parsedHeader = parseBlockHeader(headerContent, headerLine);
            if ((0, error_1.isError)(parsedHeader)) {
                blocks.push(parsedHeader);
                i++;
                continue;
            }
            const contentLines = [];
            let j = i + 1;
            let foundClosing = false;
            while (j < lines.length) {
                const contentLine = lines[j];
                if (closingFenceRegex.test(contentLine)) {
                    foundClosing = true;
                    break;
                }
                contentLines.push(contentLine);
                j++;
            }
            if (!foundClosing) {
                blocks.push((0, error_1.error)(headerLine, "未闭合的 seml 代码块", line));
                i++;
                continue;
            }
            const content = contentLines.join('\n');
            blocks.push({
                type: parsedHeader.type,
                name: parsedHeader.name,
                content,
                startLine: i + 2,
                headerLine
            });
            i = j + 1;
        }
        else {
            i++;
        }
    }
    return blocks;
}
exports.extractSemlBlocks = extractSemlBlocks;
//# sourceMappingURL=block_extractor.js.map