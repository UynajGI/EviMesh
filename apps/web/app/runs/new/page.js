import { ResearchWriteHandoff } from '@/components/research-write-handoff';

export default function NewRunReceiptPage() {
  return <ResearchWriteHandoff command="sq run record --out ./run.json" description="Runs and their inputs belong to the forward research graph. Record them through CLI or MCP, then inspect the resulting revision here." eyebrow="Run authoring" kind="run" />;
}
