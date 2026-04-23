# 🎮 User Interface & Interaction Features

Flux Flow is designed to be a high-performance terminal application. Beyond basic chat, it includes a variety of advanced UI features and human-in-the-loop controls to keep you in command of the agent.

## ⌨️ Command System

You can control the application using `/` commands directly in the chat input:

- **/mode [flux|flow]**: Quickly switch between **Flux** (Dev) and **Flow** (Chat) modes. Using it without arguments opens the selection menu.
- **/thinking [low|medium|high|max|show|hide]**: Adjust reasoning depth or toggle visibility of the thinking process. Using it without arguments opens the selection menu.
- **/model [name]**: Choose which AI model to use for the main interaction.
- **/key**: Open the API Key management view to update or remove your credentials.
- **/settings**: Access the system configuration menu.
- **/profile**: Update your name, nickname, and custom instructions.
- **/memory**: View and manage the persistent memories extracted by the Janitor.
- **/resume <chat-id>**: Switch back to a previous conversation.
- **/help**: List all available commands.

### Command Shortcuts

For power users, several commands support direct arguments to skip the menus:
- ` /mode flux ` or ` /mode flow `
- ` /thinking low ` / ` /thinking medium ` / ` /thinking high ` / ` /thinking max `
- ` /thinking show ` / ` /thinking hide ` (Toggles thinking process visibility)
- ` /model gemini-3.1-pro-preview ` (Switches model directly)

## 🧠 Thinking Levels & Visualization

Flux Flow separates the model's "internal monologue" (reasoning) from its final response using `<think>` tags.

- **Thinking Levels**: Depending on the mode, you can choose from **Low**, **Medium**, **High**, or **Max**. Higher levels allow the agent more "space" to reason through complex architecture or debugging problems.
- **Show/Hide Thinking**: You can toggle the visibility of the thinking process using `/thinking show/hide`. 
  - When **Hidden**, the agent doesn't just disappear; it provides a "minimalist" view showing only the core **Headings** and **Action Steps** (bolded lines) from its reasoning. This keeps you informed of its current "step" without cluttering the screen with detailed internal monologue.

## 🛡️ Human-in-the-Loop (HITL) Verification

Security and safety are paramount when an AI has access to your file system and terminal. Flux Flow implements several layers of verification:

### Tool Approval
By default, the agent **cannot** execute dangerous actions without your consent.
- **Terminal Approval**: If the agent attempts to run a shell command (`exec_command`), a dedicated approval screen appears showing the exact command. You can **Allow** or **Deny** the execution.
- **File Approval**: Similar to terminal commands, writing or updating files requires manual approval unless configured otherwise.
- **Safe Commands**: Basic read-only commands (like `ls`, `git status`, `pwd`) are automatically allowed to minimize friction.

### Auto-Execution (Advanced)
For power users, **Auto-Exec** can be enabled in `/settings`. 
- **⚠️ Warning**: This allows the agent to run any tool and execute any command autonomously.
- **External Access**: You can also toggle whether the agent is allowed to access files outside of its current working directory.

## 🔄 Steering & Resolution

### Real-time Steering
If you realize the agent is going down the wrong path *while* it is in an agentic loop, you can provide "Steering Hints." The system will inject your feedback into the next loop to course-correct the agent.

### Resolution Modal
If the agent finishes its task just as you send a steering hint, a **Resolution Modal** appears. It asks if you want to:
- **Send Anyway**: Start a new loop with your feedback.
- **Edit Prompt**: Refine your feedback before sending.

## 📊 Status Bar & Feedback
The bottom of the screen features a dynamic status bar showing:
- **Active Mode** (Flux/Flow)
- **Thinking Level**
- **Token Usage**: Real-time tracking of tokens used in the current session.
- **Agentic Loops**: Counters showing how many times the agent has "looped" to solve the current task.
- **API Status**: Visual feedback when the model is thinking or executing a tool.