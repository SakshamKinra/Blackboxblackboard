# Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This leads to more readable messages that are easy to follow when looking through the project history.

## 📝 Format
```
<type>(<optional scope>): <description>
```

## 🏷 Types
- **feat**: A new feature
- **fix**: A bug fix
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **docs**: Documentation only changes
- **chore**: Changes to the build process or auxiliary tools/libraries

## 💡 10 Real Examples for BlackBoard

1. **feat(canvas):** add real-time cursor tracking for collaborators
2. **feat(ui):** implement floating command palette for quick actions
3. **fix(socket):** resolve race condition causing duplicate sticky notes
4. **fix(text):** fix caret jumping to end of line during live editing
5. **refactor(board):** migrate drawing engine to object-based architecture
6. **refactor(state):** decouple UI updates from MongoDB persistence logic
7. **docs(readme):** add architecture diagram and deployment instructions
8. **docs(api):** document socket event payloads in wiki
9. **chore(deps):** update react and socket.io-client to latest versions
10. **chore(git):** remove accidentally tracked node_modules from history
