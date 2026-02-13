"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const error_1 = require("../../error");
const block_extractor_1 = require("../../block_extractor");
const chai_1 = require("chai");
describe("parseBlockHeader", () => {
    it("should parse type from header", () => {
        const result = (0, block_extractor_1.parseBlockHeader)("type=smash", 1);
        (0, chai_1.expect)(result).to.deep.equal({ type: "smash", name: undefined });
    });
    it("should parse both type and name", () => {
        const result = (0, block_extractor_1.parseBlockHeader)("type=explode name=test", 1);
        (0, chai_1.expect)(result).to.deep.equal({ type: "explode", name: "test" });
    });
    it("should be case-insensitive for type value", () => {
        const result = (0, block_extractor_1.parseBlockHeader)("type=REFRESH", 1);
        (0, chai_1.expect)(result).to.deep.equal({ type: "refresh", name: undefined });
    });
    it("should parse quoted names with spaces", () => {
        const result = (0, block_extractor_1.parseBlockHeader)('type=pogo name="my test"', 1);
        (0, chai_1.expect)(result).to.deep.equal({ type: "pogo", name: "my test" });
    });
    it("should return an error if type is missing", () => {
        (0, chai_1.expect)((0, block_extractor_1.parseBlockHeader)("name=test", 1)).to.deep.equal((0, error_1.error)(1, "缺少 type 属性", "name=test"));
    });
    it("should return an error if type is invalid", () => {
        (0, chai_1.expect)((0, block_extractor_1.parseBlockHeader)("type=invalid", 1)).to.deep.equal((0, error_1.error)(1, "无效的测试类型", "invalid"));
    });
});
describe("extractSemlBlocks", () => {
    it("should extract a single block", () => {
        const text = "Line 1\n" + "```seml type=smash\n" + "w 601\n" + "```\n" + "Line 6";
        const result = (0, block_extractor_1.extractSemlBlocks)(text);
        (0, chai_1.expect)(result).to.have.lengthOf(1);
        const block = result[0];
        if ((0, error_1.isError)(block)) {
            throw new Error("Expected block, got error");
        }
        (0, chai_1.expect)(block.type).to.equal("smash");
        (0, chai_1.expect)(block.content).to.equal("w 601");
        (0, chai_1.expect)(block.startLine).to.equal(3);
    });
    it("should return error for missing type", () => {
        const text = "```seml name=test\n" + "w 601\n" + "```";
        const result = (0, block_extractor_1.extractSemlBlocks)(text);
        (0, chai_1.expect)(result).to.have.lengthOf(1);
        (0, chai_1.expect)(result[0]).to.deep.equal((0, error_1.error)(1, "缺少 type 属性", "name=test"));
    });
    it("should return error for unclosed fence", () => {
        const text = "```seml type=smash\n" + "w 601";
        const result = (0, block_extractor_1.extractSemlBlocks)(text);
        (0, chai_1.expect)(result).to.have.lengthOf(1);
        (0, chai_1.expect)(result[0]).to.deep.equal((0, error_1.error)(1, "未闭合的 seml 代码块", "```seml type=smash"));
    });
});
//# sourceMappingURL=block_extractor.test.js.map