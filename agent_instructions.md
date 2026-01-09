We are currently implementing a web based board game. I've written up all the game rules which you can reference (if you need) in rules_draft.md, this is my english plain text rules, it's somewhat duplicative with technical_spec and implementation_plan but could be useful for you to check if you need to get a vibe of the game or check specific interactions. It's quite large. I've written up an implementation plan that lives in implementation_plan.md. I've also written up a rough technical_spec in technical_spec.md You are to work on the plan and check the progress.md file to see where we are at and what needs to be done. Feel free to edit and write to progress.md whenever you need. For each part of the implemetation plan we should go through and break down each task / milestone into whatever subtasks are required. After completing a task or subtask make sure you update the progress.md and commit your work. Over time we will get this done together. Ask me any clarifying questions if you need during work. Your code style should be clean and extensible. The rules and individual cards are still subject to change and I will be adding new cards down the line as I build out this game so the code needs to be as extensible as possible. Make it clean and concise and extensible. Don't code too overly defensively but add sufficient checks where it's actually needed. Use your best judgement but we want the code to be readable and nice. Start by reading implementation_plan and the progress to see what needs to be done next. I have added the partykit docs in this repo under partykit_docs. If you need any additional documentation for other libraries please let me know and I will add it to the repo. The implementation_plan is my best guess at how things should be implemented before I have started testing or writing any code, therefore if you feel the need to not follow it or we discover new things then that's fine we can be flexible. It's intended as a starting point. I need the cards to live somewhere where I can edit them (not with a nice frontend but I want to be able to quickly tweak costs, effects and damage, initiative order etc from some sort of file).

When starting a new task, read the instructions, `progress.md`, and `implementation_plan.md`, then decide what you will work on next and log it in `progress.md` before writing any code. The log entry must include owner, scope, and the files you plan to touch. If your task depends on another agent, do the planning/reading first, document the dependency, and avoid overlapping edits until it is unblocked. DO THIS AS SOON AS POSSIBLE ONCE YOU DECIDE WHAT TASK YOU WILL DO NEXT.

Keep a short log in `progress.md` of what you did and what's next; if you're blocked by another agent, log the dependency and stop after planning. Clear your active task entry once the work is complete and note the completion in the log.

As we develop I want us to create tests and run them to ensure that things work properly. Don't worry about the UI too much right now, just make things render and have like basic styling, I'll work on the styling later. The styling setup should be such that I can easily change things up later and even move and shift components around (essentially it shouldn't be too tightly coupled with the state if I want to make changes later).

When you create components or things I don't want these single massive files, obviously use your best judgement but if you can try to seperate components into different files and organize code cleanly and well.

By the way sometimes in implementation plan I (the boss) sometimes just add random phases or things I want addressed. You should if you choose to take on that task, expand it out to make it a better spec to the best of what you interpret my intentions to be and then add all the check mark things for it.

## Parallel agent workflow
If multiple agents are running at once:
- Before coding, claim a task in progress.md with: owner, scope, files you plan to touch, and status (this is mandatory).
- Overlapping file edits are acceptable for throughput; if a file is already claimed and you still need it, note the overlap in progress.md and try to avoid touching the same lines when possible.
- Prefer to avoid simultaneous coding in the same area, but do not block if it slows progress.
- After finishing a task or subtask, update progress.md to remove the active task entry, add a short completion note, and commit.
Coordination vibe: plan first, log early/often, and if you're blocked by another task, document the dependency and pause after planning.
If you notice changes that clearly belong to another agent’s claimed scope, treat them as expected: avoid touching those files, don’t revert them, and only surface conflicts or blockers.
If you see unclaimed changes in your scope that you didn’t make, assume they are from another agent and proceed; include them in your commit and log the overlap in `progress.md`.
If you see unexpected changes that are not plausibly from other agents or tooling, pause and ask before proceeding.

## Git hygiene + autonomy
Use common sense to keep work moving without pulling the user in for routine git cleanup.
- Prefer `git add <paths>` over `git add .` and check `git status -sb` before committing.
- If unrelated files are staged, unstage them (e.g., `git restore --staged <path>`) instead of asking the user.
- If a commit accidentally includes extra benign files, leave it and move on; only fix with a follow-up commit (no history rewrites) when it would cause harm or confusion.
- It's fine to include other agents' unclaimed changes in your commit when working in the same area; keep a note in `progress.md`.
- Avoid deleting/overwriting other agents' work; never use destructive git commands unless explicitly asked.
- Escalate to the user only when a git issue blocks progress, risks data loss, or policy requires it (still follow the stop rule for truly unexpected changes).


If (and only if) there are no more tasks then we should confirm that everything works, look for bugs, compare to the ruleset to ensure everything works as expected, add new tasks if needed, add more tests, make sure all cards work and that the UI's are polished.

If you make a new HUD or UI try to be smart about it, generally for new screens try to make them overlays.