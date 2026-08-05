CREATE TYPE "public"."contribution_edge_type" AS ENUM('produced', 'used');--> statement-breakpoint
CREATE TABLE "contribution_edges" (
	"statement_id" text NOT NULL,
	"edge_type" "contribution_edge_type" NOT NULL,
	"object_type" text NOT NULL,
	"object_id" text NOT NULL,
	"object_revision" integer NOT NULL,
	CONSTRAINT "contribution_edges_pkey" PRIMARY KEY("statement_id","edge_type","object_type","object_id","object_revision"),
	CONSTRAINT "contribution_edges_object_type_nonempty" CHECK ("contribution_edges"."object_type" <> ''),
	CONSTRAINT "contribution_edges_object_id_nonempty" CHECK ("contribution_edges"."object_id" <> ''),
	CONSTRAINT "contribution_edges_object_revision_positive" CHECK ("contribution_edges"."object_revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "contribution_edges" ADD CONSTRAINT "contribution_edges_statement_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."contribution_statements"("statement_id") ON DELETE restrict ON UPDATE no action;