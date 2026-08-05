ALTER TABLE "research_contract_revisions" DROP CONSTRAINT "research_contract_revisions_contract_id_research_contracts_contract_id_fk";
--> statement-breakpoint
ALTER TABLE "research_contract_revisions" ADD CONSTRAINT "research_contract_revisions_contract_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."research_contracts"("contract_id") ON DELETE no action ON UPDATE no action;