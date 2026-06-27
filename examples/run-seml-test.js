"use strict";

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { execFileSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const parserPath = path.join(repoRoot, "out", "parser.js");

const tests = {
	smash: {
		command: "seml.testSmash",
		displayName: "Smash",
		binary: "smash_test.exe",
		sample: "smash.seml",
	},
	explode: {
		command: "seml.testExplode",
		displayName: "Explode",
		binary: "explode_test.exe",
		sample: "explode.seml",
	},
	refresh: {
		command: "seml.testRefresh",
		displayName: "Refresh",
		binary: "refresh_test.exe",
		sample: "refresh.seml",
	},
	pogo: {
		command: "seml.testPogo",
		displayName: "Pogo",
		binary: "pogo_test.exe",
		sample: "pogo.seml",
	},
	imp: {
		command: "seml.testImp",
		displayName: "Imp",
		binary: "imp_test.exe",
		sample: "imp.seml",
	},
	pos: {
		command: "seml.testPos",
		displayName: "Pos",
		binary: "pos_test.exe",
		sample: "pos.seml",
	},
};

function fail(message) {
	console.error(message);
	process.exit(1);
}

function printUsage() {
	console.log("用法:");
	console.log("  node examples/run-seml-test.js <type> <file.seml>");
	console.log("  node examples/run-seml-test.js --list");
	console.log("");
	console.log("示例:");
	console.log("  npm run eg:test -- pos examples/丑.seml");
	console.log("  npm run eg:test -- refresh path\\to\\refresh.seml");
	console.log("");
	printTestList();
}

function printTestList() {
	console.log("支持的测试类型:");
	for (const [type, test] of Object.entries(tests)) {
		console.log(`  ${type.padEnd(8)} ${test.command.padEnd(17)} ${test.binary}`);
	}
}

function normalizeType(value) {
	const lower = value.trim().toLowerCase();
	const chopped = lower
		.replace(/^seml\.test/, "")
		.replace(/^test/, "");
	return chopped;
}

function loadParser() {
	if (!fs.existsSync(parserPath)) {
		fail("未找到 out/parser.js。请先在项目根目录运行 npm run compile。");
	}
	return require(parserPath).parse;
}

function resolveSemlPath(testType, fileArg) {
	if (fileArg !== undefined && fileArg.length > 0) {
		return path.resolve(process.cwd(), fileArg);
	}
	fail(`请提供 ${testType} 测试的 SEML 文件路径`);
}

function ask(question) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	return new Promise(resolve => {
		rl.question(question, answer => {
			rl.close();
			resolve(answer);
		});
	});
}

async function collectInteractiveArgs() {
	const entries = Object.entries(tests);
	console.log("请选择测试类型:");
	for (let i = 0; i < entries.length; i++) {
		const [type, test] = entries[i];
		console.log(`  ${i + 1}. ${type} (${test.command})`);
	}

	const typeAnswer = await ask("输入序号或类型: ");
	const typeIndex = Number(typeAnswer.trim());
	const selectedType = Number.isInteger(typeIndex) && typeIndex >= 1 && typeIndex <= entries.length
		? entries[typeIndex - 1][0]
		: normalizeType(typeAnswer);

	if (!(selectedType in tests)) {
		fail(`未知测试类型: ${typeAnswer}`);
	}

	const fileAnswer = await ask("SEML 文件路径: ");
	if (fileAnswer.trim().length === 0) {
		fail("请提供 SEML 文件路径");
	}
	return { testType: selectedType, semlPath: resolveSemlPath(selectedType, fileAnswer.trim()) };
}

function parseCliArgs() {
	const args = process.argv.slice(2);
	if (args.includes("--help") || args.includes("-h")) {
		printUsage();
		process.exit(0);
	}
	if (args.includes("--list")) {
		printTestList();
		process.exit(0);
	}

	const positional = args.filter(arg => !arg.startsWith("-"));
	const rawType = positional[0];
	if (rawType === undefined) {
		return null;
	}

	const testType = normalizeType(rawType);
	if (!(testType in tests)) {
		fail(`未知测试类型: ${rawType}`);
	}

	return {
		testType,
		semlPath: resolveSemlPath(testType, positional[1]),
	};
}

function makeBinaryArgs(testType, parsedArgs) {
	if (testType === "imp") {
		return ["repeat", "cobDelay"].flatMap(argName => parsedArgs[argName] ?? []);
	}

	return Object.values(parsedArgs).flatMap(value => value);
}

function runTest(testType, semlPath) {
	const test = tests[testType];
	const binaryPath = path.join(repoRoot, "out", "bin", test.binary);

	if (!fs.existsSync(semlPath)) {
		fail(`未找到 SEML 文件: ${semlPath}`);
	}
	if (!fs.existsSync(binaryPath)) {
		fail(`未找到测试二进制: ${binaryPath}`);
	}

	const parse = loadParser();
	const text = fs.readFileSync(semlPath, "utf8");
	const parsed = parse(text);
	if (parsed?.type === "Error") {
		fail(`[第${parsed.lineNum}行] ${parsed.msg}: ${parsed.src}`);
	}

	const baseName = path.basename(semlPath, path.extname(semlPath));
	const tempDir = path.join(__dirname, ".tmp");
	const destDir = path.join(__dirname, "dest");
	fs.mkdirSync(tempDir, { recursive: true });
	fs.mkdirSync(destDir, { recursive: true });

	const jsonPath = path.join(tempDir, `${baseName}_${testType}.json`);
	const outputPrefix = path.join(destDir, `${baseName}_${testType}`);
	fs.writeFileSync(jsonPath, JSON.stringify(parsed.out, null, 4), "utf8");

	const binaryArgs = [
		...makeBinaryArgs(testType, parsed.args),
		"-f", jsonPath,
		"-o", outputPrefix,
	];

	console.log(`测试类型: ${testType} (${test.command})`);
	console.log(`SEML: ${semlPath}`);
	console.log(`临时 JSON: ${jsonPath}`);
	console.log(`输出前缀: ${outputPrefix}`);
	console.log(`命令: ${binaryPath} ${binaryArgs.join(" ")}`);

	try {
		const stdout = execFileSync(binaryPath, binaryArgs, { encoding: "utf8" });
		console.log(stdout.trim());
	} finally {
		fs.rmSync(jsonPath, { force: true });
		try {
			fs.rmdirSync(tempDir);
		} catch {
			// Keep the temp directory if another run is still using it.
		}
	}
}

async function main() {
	const cliArgs = parseCliArgs();
	const selected = cliArgs ?? (process.stdin.isTTY ? await collectInteractiveArgs() : null);
	if (selected === null) {
		printUsage();
		process.exit(1);
	}

	runTest(selected.testType, selected.semlPath);
}

main().catch(err => {
	fail(err instanceof Error ? err.message : String(err));
});
