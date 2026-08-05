import { actors } from './actors.mjs';
import { actorProfiles } from './actor-profiles.mjs';
import { apiTokens } from './api-tokens.mjs';
import { identities } from './identities.mjs';
import { organizations } from './organizations.mjs';
import { organizationMembers } from './organization-members.mjs';
import { projects } from './projects.mjs';
import { projectRevisions } from './project-revisions.mjs';
import { projectMembers } from './project-members.mjs';
import { questions } from './questions.mjs';
import { questionRevisions } from './question-revisions.mjs';
import { researchContracts } from './research-contracts.mjs';
import { researchContractRevisions } from './research-contract-revisions.mjs';
import { signingKeys } from './signing-keys.mjs';
import { tasks } from './tasks.mjs';
import { contextMode, taskRevisions } from './task-revisions.mjs';
import { taskDependencies } from './task-dependencies.mjs';
import { taskLeases } from './task-leases.mjs';
import { attempts } from './attempts.mjs';
import { traceEvents } from './trace-events.mjs';
import { claims } from './claims.mjs';
import { claimRevisions } from './claim-revisions.mjs';
import { claimRelations } from './claim-relations.mjs';
import { artifacts } from './artifacts.mjs';
import { artifactRevisions } from './artifact-revisions.mjs';
import { artifactLocations } from './artifact-locations.mjs';
import { runs } from './runs.mjs';
import { runInputs } from './run-inputs.mjs';
import { runOutputs } from './run-outputs.mjs';
import { evidence } from './evidence.mjs';
import { evidenceClaimLinks } from './evidence-claim-links.mjs';
import { verificationContracts } from './verification-contracts.mjs';

export { actorProfiles } from './actor-profiles.mjs';
export { apiTokens } from './api-tokens.mjs';
export { actors, actorType, identityStrength } from './actors.mjs';
export { identities } from './identities.mjs';
export { organizations } from './organizations.mjs';
export { organizationMembers } from './organization-members.mjs';
export { projectState, projects } from './projects.mjs';
export { projectRevisions } from './project-revisions.mjs';
export { projectMembers } from './project-members.mjs';
export { questionState, questions } from './questions.mjs';
export { questionRevisions } from './question-revisions.mjs';
export { researchContracts } from './research-contracts.mjs';
export { contractRiskLevel, researchContractRevisions } from './research-contract-revisions.mjs';
export { taskState, tasks } from './tasks.mjs';
export { contextMode, taskRevisions } from './task-revisions.mjs';
export { taskDependencies, taskDependencyType } from './task-dependencies.mjs';
export { taskLeases } from './task-leases.mjs';
export { attemptState, attempts } from './attempts.mjs';
export { traceEvents } from './trace-events.mjs';
export { claimState, claims } from './claims.mjs';
export { claimRevisions } from './claim-revisions.mjs';
export { claimRelations, claimRelationType } from './claim-relations.mjs';
export { artifacts } from './artifacts.mjs';
export { artifactRevisions, artifactType } from './artifact-revisions.mjs';
export { artifactLocations } from './artifact-locations.mjs';
export { runs } from './runs.mjs';
export { runInputs } from './run-inputs.mjs';
export { runOutputs } from './run-outputs.mjs';
export { evidence, evidenceType } from './evidence.mjs';
export { evidenceClaimLinks, evidenceClaimRelation } from './evidence-claim-links.mjs';
export { verificationContracts } from './verification-contracts.mjs';
export { signingKeys } from './signing-keys.mjs';

export const schema = {
  actors,
  actorProfiles,
  identities,
  signingKeys,
  apiTokens,
  organizations,
  organizationMembers,
  projects,
  projectRevisions,
  projectMembers,
  questions,
  questionRevisions,
  researchContracts,
  researchContractRevisions,
  tasks,
  taskRevisions,
  taskDependencies,
  taskLeases,
  attempts,
  traceEvents,
  claims,
  claimRevisions,
  claimRelations,
  artifacts,
  artifactRevisions,
  artifactLocations,
  runs,
  runInputs,
  runOutputs,
  evidence,
  evidenceClaimLinks,
  verificationContracts,
};

export default schema;
