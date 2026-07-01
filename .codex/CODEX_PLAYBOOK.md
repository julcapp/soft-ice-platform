# Codex Playbook

Статус: Draft
Версия: 0.1
Проект: Soft ICE Platform / «У Тимоши»

## 1. Назначение

Документ описывает операционные правила работы Codex Desktop в проекте Soft ICE Platform.

Codex должен использовать этот документ вместе с `AGENTS.md`, `PROJECT_MEMORY.md` и `.codex/TASK_TEMPLATE.md`.

## 2. Роль Codex

Codex является Software Engineer проекта.

Он выполняет инженерные задачи по техническим заданиям из `docs/tasks/` и не принимает самостоятельных продуктовых решений.

## 3. Разрешённые команды без отдельного подтверждения

Разрешены для проверки и сборки:

```text
npm install
npm run build
npm test
npx vite build
git status
git diff
git log
```

## 4. Команды только после подтверждения пользователя

Требуют подтверждения:

```text
git push
git reset
git clean
git rebase
git merge
delete / remove file operations
package upgrades
package removals
```

## 5. Windows environment

Основная среда разработки:

```text
Windows
Codex Desktop
GitHub Desktop
Repository: C:\Users\iav\Documents\GitHub\soft-ice-platform
Node.js: C:\Program Files\nodejs
npm: C:\Program Files\nodejs\npm.cmd
```

Если `npm` не найден в PATH, Codex должен попробовать:

```text
C:\Program Files\nodejs\npm.cmd
```

## 6. Build procedure

Стандартная проверка Mini App:

```text
cd frontend/miniapp
npm install
npm run build
git status
```

После сборки Codex должен убедиться, что `dist/` не попал в изменения Git.

## 7. Перед завершением задачи

Codex должен сообщить:

1. список изменённых файлов;
2. что было создано;
3. какие публичные методы добавлены;
4. результат build;
5. изменялись ли UI, стили, роутинг или assets;
6. краткое архитектурное резюме.

## 8. Запрещено

Codex не должен:

- менять UI без прямого задания;
- менять архитектуру без задания;
- коммитить секреты;
- добавлять `dist/`;
- делать `git push` самостоятельно;
- удалять файлы без подтверждения;
- менять бизнес-решения без Product Owner.
