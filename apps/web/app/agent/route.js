import { agentManualMarkdown } from '@/lib/agent-manual';

export const dynamic = 'force-static';

export function GET() {
  return new Response(agentManualMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
    },
  });
}
