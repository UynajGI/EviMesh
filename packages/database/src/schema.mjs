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
import { signingKeys } from './signing-keys.mjs';

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
};

export default schema;
