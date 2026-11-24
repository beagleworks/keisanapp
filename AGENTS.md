# AGENTS.md

## コードレビュー方針 / Code Review Guidelines

- **レビューは日本語で行ってください。**
- Pull Request のレビューコメント、サマリー、指摘事項、改善提案はすべて日本語で記述してください。
- All pull request reviews, inline review comments, and review summaries MUST be written in Japanese.
- **レビュー対応が完了したら、対象のレビュースレッドを Resolve してください。**
- After addressing pull request review comments (fixing, pushing, and replying) and finishing review follow-ups, resolve the corresponding review threads.

## 開発コマンド / Development Commands

パッケージマネージャには `pnpm` を使用します。

- 型チェック: `pnpm typecheck`
- テスト: `pnpm test`
- ビルド: `pnpm build`
