import { error, isError } from "../../error";
import { parseBlockHeader, extractSemlBlocks } from "../../block_extractor";
import { expect } from 'chai';

describe("parseBlockHeader", () => {
	it("should parse type from header", () => {
		const result = parseBlockHeader("type=smash", 1);
		expect(result).to.deep.equal({ type: "smash", name: undefined });
	});

	it("should parse both type and name", () => {
		const result = parseBlockHeader("type=explode name=test", 1);
		expect(result).to.deep.equal({ type: "explode", name: "test" });
	});

	it("should be case-insensitive for type value", () => {
		const result = parseBlockHeader("type=REFRESH", 1);
		expect(result).to.deep.equal({ type: "refresh", name: undefined });
	});

	it("should parse quoted names with spaces", () => {
		const result = parseBlockHeader('type=pogo name="my test"', 1);
		expect(result).to.deep.equal({ type: "pogo", name: "my test" });
	});

	it("should parse imp type", () => {
		const result = parseBlockHeader("type=imp name=test", 1);
		expect(result).to.deep.equal({ type: "imp", name: "test" });
	});

	it("should return an error if type is missing", () => {
		expect(parseBlockHeader("name=test", 1)).to.deep.equal(
			error(1, "缺少 type 属性", "name=test")
		);
	});

	it("should return an error if type is invalid", () => {
		expect(parseBlockHeader("type=invalid", 1)).to.deep.equal(
			error(1, "无效的测试类型", "invalid")
		);
	});
});

describe("extractSemlBlocks", () => {
	it("should extract a single block", () => {
		const text = "Line 1\n" + "```seml type=smash\n" + "w 601\n" + "```\n" + "Line 6";
		const result = extractSemlBlocks(text);
		expect(result).to.have.lengthOf(1);
		const block = result[0]!;
		if (isError(block)) {
			throw new Error("Expected block, got error");
		}
		expect(block.type).to.equal("smash");
		expect(block.content).to.equal("w 601");
		expect(block.startLine).to.equal(3);
	});

	it("should return error for missing type", () => {
		const text = "```seml name=test\n" + "w 601\n" + "```";
		const result = extractSemlBlocks(text);
		expect(result).to.have.lengthOf(1);
		expect(result[0]).to.deep.equal(error(1, "缺少 type 属性", "name=test"));
	});

	it("should return error for unclosed fence", () => {
		const text = "```seml type=smash\n" + "w 601";
		const result = extractSemlBlocks(text);
		expect(result).to.have.lengthOf(1);
		expect(result[0]).to.deep.equal(error(1, "未闭合的 seml 代码块", "```seml type=smash"));
	});
});
