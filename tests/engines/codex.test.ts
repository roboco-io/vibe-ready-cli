import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCodex } from "../../src/engines/codex.js";
import type { EngineRequest } from "../../src/engines/types.js";
const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function fixture(mode = "success") {
  const dir = await mkdtemp(join(tmpdir(), "codex-test-")); dirs.push(dir);
  const script = join(dir, "mock.mjs"); const capture = join(dir, "capture.json");
  await writeFile(script, `import fs from "node:fs";import {spawn} from "node:child_process";
const [mode,capture,...args]=process.argv.slice(2);
let prompt="";for await(const part of process.stdin)prompt+=part;
const schema=JSON.parse(fs.readFileSync(args[args.indexOf("--output-schema")+1],"utf8"));
fs.writeFileSync(capture,JSON.stringify({args,prompt,schema,cwd:process.cwd(),pid:process.pid}));
if(mode==="tree"){const child=spawn(process.execPath,["-e","process.on(String.fromCharCode(83,73,71,84,69,82,77),()=>{});setInterval(()=>{},1000)"],{stdio:"ignore"});fs.writeFileSync(capture,JSON.stringify({args,cwd:process.cwd(),pid:process.pid,childPid:child.pid}));process.on("SIGTERM",()=>{});setInterval(()=>{},1000);}
else if(mode==="wait"){process.on("SIGTERM",()=>{});setInterval(()=>{},1000);}
else if(mode==="flood")process.stdout.write("x".repeat(9_000_000));
else {fs.writeFileSync(args[args.indexOf("--output-last-message")+1],mode==="invalid"?"secret malformed":mode==="largefile"?JSON.stringify({answer:"x".repeat(2_100_000)}):JSON.stringify({answer:"ready"}));
console.log(mode==="malformed"?"secret stderr":JSON.stringify({type:mode==="partial"?"turn.started":"turn.completed"}));
console.error("ghp_secret_should_never_leak");process.exitCode=mode==="failure"?3:0;}`);
  const request: EngineRequest = { repoPath: dir, prompt: "Inspect current working directory; literal $(touch BAD)", schema: { type: "object", properties: { answer: { type: "string" }, nested: { type: "object", properties: { ok: { type: "boolean" } } } }, required: ["answer"] }, abortController: new AbortController() };
  return { request, capture, options: { executable: process.execPath, args: [script, mode, capture] } };
}
describe("Codex adapter", () => {
  it("uses isolated read-only stdin execution, strict schema and cleans temporary files", async () => {
    const f = await fixture(); const result = await runCodex(f.request, f.options);
    expect(result).toEqual({ engine: "codex", output: { answer: "ready" } });
    const capture = JSON.parse(await readFile(f.capture, "utf8"));
    expect(capture.cwd).not.toBe(f.request.repoPath);
    expect(capture.args).toEqual(expect.arrayContaining(["exec", "--json", "--sandbox", "read-only", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--strict-config", "--skip-git-repo-check", "approval_policy=\"never\"", "web_search=\"disabled\"", "shell_environment_policy.inherit=\"none\"", "project_doc_max_bytes=0", "-"]));
    expect(capture.prompt).toContain(f.request.repoPath); expect(capture.prompt).toContain(f.request.prompt);
    expect(capture.schema.additionalProperties).toBe(false); expect(capture.schema.required).toEqual(["answer", "nested"]);
    expect(capture.schema.properties.nested.additionalProperties).toBe(false);
    await expect(access(capture.cwd)).rejects.toThrow();
    await expect(access(join(f.request.repoPath, "BAD"))).rejects.toThrow();
  });
  it.each(["failure", "invalid", "malformed", "partial", "flood", "largefile"])("rejects %s output without raw content and cleans up", async mode => {
    const f = await fixture(mode);
    await expect(runCodex(f.request, f.options)).rejects.toThrow(/Codex/);
    const capture = JSON.parse(await readFile(f.capture, "utf8"));
    await expect(access(capture.cwd)).rejects.toThrow();
    try { await runCodex(f.request, f.options); } catch (error) { expect(String(error)).not.toContain("secret"); }
  });
  it("provides a localized install hint for missing executable", async () => {
    const f = await fixture(); await expect(runCodex(f.request, { executable: join(f.request.repoPath, "missing") })).rejects.toThrow(/설치/);
  });
  it("aborts an uncooperative owned process and cleans temporary files", async () => {
    const f = await fixture("wait"); const promise = runCodex(f.request, f.options); const rejection = expect(promise).rejects.toThrow(/취소/);
    for (let i = 0; i < 100; i++) { try { await access(f.capture); break; } catch { await new Promise(resolve => setTimeout(resolve, 10)); } }
    f.request.abortController.abort(); await rejection;
    const capture = JSON.parse(await readFile(f.capture, "utf8"));
    expect(() => process.kill(capture.pid, 0)).toThrow(); await expect(access(capture.cwd)).rejects.toThrow();
  });
  it("terminates owned descendants on cancellation", async () => {
    const f = await fixture("tree"); const promise = runCodex(f.request, f.options); const rejection = expect(promise).rejects.toThrow(/취소/);
    let capture: { cwd: string; childPid?: number } | undefined;
    for (let i = 0; i < 100; i++) {
      try { capture = JSON.parse(await readFile(f.capture, "utf8")); if (capture?.childPid) break; } catch { /* Wait for child start. */ }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(capture?.childPid).toBeTypeOf("number");
    f.request.abortController.abort(); await rejection;
    for (let i = 0; i < 100; i++) {
      try { process.kill(capture!.childPid!, 0); } catch { break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(() => process.kill(capture!.childPid!, 0)).toThrow();
    await expect(access(capture!.cwd)).rejects.toThrow();
  });

  it("localizes invalid target errors without disclosing raw paths", async () => {
    const f = await fixture(); f.request.repoPath = join(f.request.repoPath, "secret-missing-target");
    await expect(runCodex(f.request, f.options)).rejects.toThrow(/Codex/);
    try { await runCodex(f.request, f.options); } catch (error) { expect(String(error)).not.toContain("secret-missing-target"); }
  });

});
