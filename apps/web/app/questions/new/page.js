import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function NewQuestionPage() {
  return <ResearchWriteHandoff command="sq --help" description="Questions enter the attributable research record through an Agent connection. Browse and inspect questions here; prepare new work through CLI or MCP." eyebrow="Question authoring" kind="question" />;
}
