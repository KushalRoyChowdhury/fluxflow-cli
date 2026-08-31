// Export tools.md content to string
export const TOOLS_MD = `# FluxFlow Tool Reference

## Protocol: [tool:functions.ToolName(arg1="val")]

## 1. Workspace
* ReadFile(path, startLine?, endLine?) → Read text/code/PDF/image
* PatchFile(path, searchContent1..15, newContent1..15, allowMultiple?) → Atomic multi-replacement; supports ^LINE:start..end$
* WriteFile(path, content) → Create/overwrite file
* ReadFolder(path, recurse?) → List directory tree (depth: 1-3)
* CodeSearch / SearchKeyword(keyword, path?, fuzzy?, regex?) → Fast text search; path="#docs" for doc index
* Run(command) → Execute command in shell
* Todo(method, tasks?, markDone?) → Planner ("create" | "append" | "get")

## 2. Web & Communication
* WebSearch(query, aiMode?, limit?) → Live web search + AI summary
* WebScrape(url) → Extract markdown from URL
* Ask(question, optionA..D?) → Interactive prompt to user ("title::desc")

## 3. Sub-Agents
* InvokeSync(title, task) → Blocking sub-agent
* Invoke(title, task) → Non-blocking worker (max 7 concurrent)
* Await(id, timeout?) → Wait for async worker
* GetProgress(id) → Telemetry & logs
* Steer(id, message) → Mid-flight direction
* Cancel(id) → Terminate worker

## 4. Emergency & Rollback
* EmergencyRollback(method, id?) → Checkpoint restore ("getCheckpoint" | "forceRevert")

## 5. Creative Documents
* WritePDF(path, content, orientation?) → Render HTML/CSS to PDF
* WriteDoc(path, content) → Render DOCX

## 6. Computer Use (GUI)
* Click(gridId, type?, button?, intendedClickText?) → Click coordinate + OCR snap
* Drag(fromGridId, toGridId) → Mouse drag
* Scroll(direction, gridId?) → Viewport scroll ("up" | "down")
* KeyboardTyping(text, autoPressEnter?) → Type string
* KeyPress(key) → Key/combo dispatch ("ctrl;c", "enter", etc.)
* RecaptureScreen() → Fresh screenshot + coordinate grid
`;
