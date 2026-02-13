import { Error, error, isError } from "./error";

export type SemlBlock = {
	readonly type: "smash" | "explode" | "refresh" | "pogo";
	readonly name: string | undefined;
	readonly content: string;
	readonly startLine: number;
	readonly headerLine: number;
};

type ParsedHeader = {
	readonly type: "smash" | "explode" | "refresh" | "pogo";
	readonly name: string | undefined;
};

export function parseBlockHeader(header: string, lineNum: number): ParsedHeader | Error {
	let type: string | undefined;
	let name: string | undefined;

	const typeMatch = /\btype=(\S+)/.exec(header);
	if (typeMatch) {
		type = typeMatch[1]!.toLowerCase();
	}

	const nameMatch = /\bname=("[^"]*"|'[^']*'|\S+)/.exec(header);
	if (nameMatch) {
		let nameValue = nameMatch[1]!;
		if ((nameValue.startsWith('"') && nameValue.endsWith('"')) ||
			(nameValue.startsWith("'") && nameValue.endsWith("'"))) {
			nameValue = nameValue.slice(1, -1);
		}
		name = nameValue;
	}

	if (type === undefined) {
		return error(lineNum, "缺少 type 属性", header);
	}

	if (type !== "smash" && type !== "explode" && type !== "refresh" && type !== "pogo") {
		return error(lineNum, "无效的测试类型", type);
	}

	if (name !== undefined) {
		const unsafeChars = /[/\\:*?"<>|]/;
		if (unsafeChars.test(name)) {
			return error(lineNum, "名称包含无效字符", name);
		}
	}

	return { type, name };
}

export function extractSemlBlocks(text: string): (SemlBlock | Error)[] {
	const lines = text.split(/\r?\n/);
	const blocks: (SemlBlock | Error)[] = [];
	const openingFenceRegex = /^```seml\b/;
	const closingFenceRegex = /^```\s*$/;

	let i = 0;
	while (i < lines.length) {
		const line = lines[i]!;
		if (openingFenceRegex.test(line)) {
			const headerLine = i + 1;
			const headerContent = line.slice(7).trim();

			const parsedHeader = parseBlockHeader(headerContent, headerLine);
			if (isError(parsedHeader)) {
				blocks.push(parsedHeader);
				i++;
				continue;
			}

			const contentLines: string[] = [];
			let j = i + 1;
			let foundClosing = false;
			while (j < lines.length) {
				const contentLine = lines[j]!;
				if (closingFenceRegex.test(contentLine)) {
					foundClosing = true;
					break;
				}
				contentLines.push(contentLine);
				j++;
			}

		if (!foundClosing) {
			blocks.push(error(headerLine, "未闭合的 seml 代码块", line));
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
		} else {
			i++;
		}
	}

	return blocks;
}
