CREATE TABLE "task_leases" (
	"task_id" text NOT NULL,
	"holder_actor_id" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_renewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "task_leases_pkey" PRIMARY KEY("task_id","holder_actor_id")
);
--> statement-breakpoint
ALTER TABLE "task_leases" ADD CONSTRAINT "task_leases_task_id_tasks_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("task_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_leases" ADD CONSTRAINT "task_leases_holder_actor_id_actors_actor_id_fk" FOREIGN KEY ("holder_actor_id") REFERENCES "public"."actors"("actor_id") ON DELETE restrict ON UPDATE no action;