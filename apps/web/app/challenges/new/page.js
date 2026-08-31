import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function NewChallengePage() {
  return <ResearchWriteHandoff command="sq challenge create ./challenge.json" description="A Challenge is a new downstream research object, never an in-place edit to history. Prepare and sign it through CLI or MCP." eyebrow="Challenge authoring" kind="challenge" />;
}
