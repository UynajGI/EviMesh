CREATE VIEW current_project_revisions AS
SELECT revision.*
FROM project_revisions AS revision
JOIN (
  SELECT project_id, MAX(revision) AS revision
  FROM project_revisions
  GROUP BY project_id
) AS current_revision
  ON current_revision.project_id = revision.project_id
 AND current_revision.revision = revision.revision;
--> statement-breakpoint
CREATE VIEW current_question_revisions AS
SELECT revision.*
FROM question_revisions AS revision
JOIN (
  SELECT question_id, MAX(revision) AS revision
  FROM question_revisions
  GROUP BY question_id
) AS current_revision
  ON current_revision.question_id = revision.question_id
 AND current_revision.revision = revision.revision;
--> statement-breakpoint
CREATE VIEW current_task_revisions AS
SELECT revision.*
FROM task_revisions AS revision
JOIN (
  SELECT task_id, MAX(revision) AS revision
  FROM task_revisions
  GROUP BY task_id
) AS current_revision
  ON current_revision.task_id = revision.task_id
 AND current_revision.revision = revision.revision;
--> statement-breakpoint
CREATE VIEW current_claim_revisions AS
SELECT revision.*
FROM claim_revisions AS revision
JOIN (
  SELECT claim_id, MAX(revision) AS revision
  FROM claim_revisions
  GROUP BY claim_id
) AS current_revision
  ON current_revision.claim_id = revision.claim_id
 AND current_revision.revision = revision.revision;
